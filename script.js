import bot from './assets/bot.svg'
import user from './assets/user.svg'
import { createClient } from '@supabase/supabase-js';
import { PromptTemplate } from '@langchain/core/prompts';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { SupabaseVectorStore } from '@langchain/community/vectorstores/supabase';
import axios from 'axios';
console.log(import.meta.env.VITE_GEMINI_API_KEY);
// Access your API key as an environment variable
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

// Define the prompt template
const standaloneQuestionTemplate = "Given a question convert it to a standalone question.If there is no valid question.Be a little rude and tell me that I should go back to learning and return only when I a question: {question} standalone question: ";
const standaloneQuestionPrompt = PromptTemplate.fromTemplate(standaloneQuestionTemplate);
let masterStandaloneQuestion = "";

// Create a function to generate the standalone question
async function generateStandaloneQuestion(question) {
    const promptText = await standaloneQuestionPrompt.format({ question });
    console.log("Question to be sent to AI model ", promptText);
    const result = await model.generateContent(promptText);
    const response = result.response.text() || 'No response';
    return response;
}

// Function to send data and get AI response
async function sendData(standaloneQuestion) {
    try {
        const response = await axios.post('http://127.0.0.1:5000/api/get_embeddings', {
            question: standaloneQuestion
        });
        const text = response.config.data;
        const embeddings = response.data.embeddings;
        return await match_documents(text, embeddings);
    } catch (error) {
        console.error('Error sending data:', error);
    }
}

async function match_documents(text, embeddings) {
    let embedder;
    try {
        console.log("Unflattened Embeddings :", embeddings);

        const client = createClient(import.meta.env.VITE_SUPABASE_URL_LC_CHATBOT, import.meta.env.VITE_SUPABASE_API_KEY);
        const parsedData = JSON.parse(text);
        const question = parsedData.question;
        console.log(question);
        const vectorStore = await SupabaseVectorStore.fromTexts(
            [question],
            [{ id: 1 }],
            {
                embedDocuments: async (texts) => {
                    const serializedEmbeddings = texts.map((text, index) => {
                        const chunk_embeddings = embeddings;

                        // Flatten the embeddings to a 1D array
                        let flattenedEmbeddings;
                        if (Array.isArray(chunk_embeddings)) {
                            flattenedEmbeddings = chunk_embeddings.flat();
                            console.log("Flattening Embeddings at scale", flattenedEmbeddings);
                        } else {
                            flattenedEmbeddings = Object.values(chunk_embeddings).flat();
                            console.log("Emperor Embeddings", flattenedEmbeddings);
                        }

                        return flattenedEmbeddings;
                    });
                    embedder = serializedEmbeddings;
                    return serializedEmbeddings;
                }
            },
            {
                client,
                tableName: 'documents',
                queryName: 'match_documents',
            }
        );

        console.log("Vector Store unleashed");
        console.log("Embedded documents on drugs", embedder);
        console.log("Embedder on cocaine", embedder[0]);

        const matchedDocuments = await vectorStore.similaritySearchVectorWithScore(embedder[0], 5);
        console.log('Matched Documents:', matchedDocuments);

        const jsonString = JSON.stringify(matchedDocuments);
        const dataArray = JSON.parse(jsonString);
        const pageContents = dataArray.map(item => item[0].pageContent);
        const combinedContent = pageContents.join(' ');
        console.log("Combined multi text", combinedContent);

        const masterPrompt = `Using the following information as context or point of reference: ${combinedContent}. Answer the following question: ${masterStandaloneQuestion}. Your answer should feel witty. Response should be five lines. Response should contain humour`;
console.log("masterPrompt:       ", masterPrompt)
        const result = await model.generateContent(masterPrompt);
        const masterAnswer = result.response.text() || 'No response';
        console.log("Master Answer", masterAnswer);
        return masterAnswer;
    } catch (error) {
        console.error('Error creating Supabase client:', error);
        throw error;
    }
}

const form = document.querySelector('form');
const chatContainer = document.querySelector('#chat_container');

let loadInterval;

function loader(element) {
    element.textContent = '';
    loadInterval = setInterval(() => {
        element.textContent += '.';
        if (element.textContent === '....') {
            element.textContent = '';
        }
    }, 300);
}

function typeText(element, text) {
    let index = 0;
    let interval = setInterval(() => {
        if (index < text.length) {
            element.innerHTML += text.charAt(index);
            index++;
            scrollToBottom();
        } else {
            clearInterval(interval);
        }
    }, 20);
}

// Function to scroll chat container to the bottom
function scrollToBottom() {
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Function to append a message to the chat container
function appendMessage(isAi, value, uniqueId) {
    const messageHtml = chatStripe(isAi, value, uniqueId);
    chatContainer.innerHTML += messageHtml;
    scrollToBottom(); // Scroll to bottom after appending message
}





function generateUniqueId() {
    const timestamp = Date.now();
    const randomNumber = Math.random();
    const hexadecimalString = randomNumber.toString(16);
    return `id-${timestamp}-${hexadecimalString}`;
}

function chatStripe(isAi, value, uniqueId) {
    return (
        `
        <div class="wrapper ${isAi && 'ai'}">
            <div class="chat">
                <div class="profile">
                    <img 
                      src=${isAi ? bot : user} 
                      alt="${isAi ? 'bot' : 'user'}" 
                    />
                </div>
                <div class="message" id=${uniqueId}>${value} </div>
            </div>
        </div>
    `
    );
}

const handleSubmit = async (e) => {
    e.preventDefault();

    const data = new FormData(form);
    const userQuestion = data.get('prompt');
    console.log("User Question:", userQuestion);

    chatContainer.innerHTML += chatStripe(false, userQuestion);

    form.reset();

    const uniqueId = generateUniqueId();
    chatContainer.innerHTML += chatStripe(true, "...", uniqueId);

    chatContainer.scrollTop = chatContainer.scrollHeight;

    const messageDiv = document.getElementById(uniqueId);
    loader(messageDiv);

    try {
        const standaloneQuestion = await generateStandaloneQuestion(userQuestion);
        masterStandaloneQuestion = standaloneQuestion;
        const aiResponse = await sendData(standaloneQuestion);

        clearInterval(loadInterval);
        messageDiv.innerHTML = '';

        if (aiResponse) {
            typeText(messageDiv, aiResponse);
        } else {
            messageDiv.innerHTML = "No response from AI.";
        }
    } catch (error) {
        clearInterval(loadInterval);
        messageDiv.innerHTML = "Something went wrong";
        console.error("Error:", error);
    }
};

form.addEventListener('submit', handleSubmit);
form.addEventListener('keyup', (e) => {
    if (e.keyCode === 13) {
        handleSubmit(e);
    }
});
