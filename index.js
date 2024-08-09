import bot from './assets/bot.svg'
import user from './assets/user.svg'
import { createClient } from '@supabase/supabase-js';
import { PromptTemplate } from '@langchain/core/prompts';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { SupabaseVectorStore } from '@langchain/community/vectorstores/supabase';
import axios from 'axios';
dotenv.config();


// Access your API key as an environment variable
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

// Define the prompt template
const standaloneQuestionTemplate = "Given a question convert it to a standalone question.: {question} standalone question: ";
const standaloneQuestionPrompt = PromptTemplate.fromTemplate(standaloneQuestionTemplate);
let masterStandaloneQuestion = ""
// Create a function to generate the standalone question
async function generateStandaloneQuestion(question) {
    const promptText = await standaloneQuestionPrompt.format({ question });
    console.log("Question to be sent to AI model ",promptText)
    const result = await model.generateContent(promptText);
    const response = result.response.text() || 'No response';
    return response;
}

// Example usage
(async () => {
    const question = 'I am currently working on a project at my company where I am leading a team to develop a new software application. There is some internal competition, and a few colleagues are trying to undermine my efforts. The project is critical for my career advancement, and I need to ensure it succeeds while maintaining a strong position within the company.I want to successfully complete the project, gain recognition for my leadership, and strengthen my influence in the company.Please provide strategic advice on how to navigate this situation using principles from the "48 Laws of Power." If possible, focus on laws that pertain to managing internal competition, gaining influence, and ensuring the success of my project.';
    const standaloneQuestion = await generateStandaloneQuestion(question);
    console.log('Standalone Question:', standaloneQuestion);
     masterStandaloneQuestion = standaloneQuestion
    await sendData(standaloneQuestion);
   
})();

async function sendData(standaloneQuestion) {
    try {
        const response = await axios.post('http://127.0.0.1:5000/api/get_embeddings', {
            question: standaloneQuestion
        });
        const text = response.config.data
        const embeddings = response.data.embeddings
        match_documents(text, embeddings);
    } catch (error) {
        console.error('Error sending data:', error);
    }
}




async function match_documents(text, embeddings) {
let embedder 
    try {
        dotenv.config();
        console.log("Unflattened Embeddings :", embeddings)

        const client = createClient(process.env.SUPABASE_URL_LC_CHATBOT, process.env.SUPABASE_API_KEY);
        // const vectorStore = new SupabaseVectorStore(client);
        // Example: Using SupabaseVectorStore to search for embeddings
        const parsedData = JSON.parse(text);
        const question = parsedData.question;
        console.log(question);
        const vectorStore = await SupabaseVectorStore.fromTexts(
            [question],
            [{ id: 1 }],

            {

                // embedDocuments:async () => {

                // }
                embedDocuments: async (texts) => {
                    const serializedEmbeddings = texts.map((text, index) => {
                        const chunk_embeddings = embeddings; // Assuming embeddings[index] is the embedding array

                        // Flatten the embeddings to a 1D array
                        let flattenedEmbeddings;
                        if (Array.isArray(chunk_embeddings)) {
                            flattenedEmbeddings = chunk_embeddings.flat();

                            console.log("Flattening Embeddings at scale", flattenedEmbeddings)


                        } else {
                            // Handle non-array structure, e.g., if chunk_embeddings is an object
                            flattenedEmbeddings = Object.values(chunk_embeddings).flat(); // Adjust based on actual structure
                            console.log("Emperor Embeddings", flattenedEmbeddings)


                        }

                        // return flattenedEmbeddings {
                        return flattenedEmbeddings
                        // metadata: {} // Replace with actual metadata if needed
                        // };
                    });
                    embedder = serializedEmbeddings
                    return serializedEmbeddings;
                }

            },
            // embeddings,
            {
                client,
                tableName: 'documents',
                queryName: 'match_documents',

            }
        );


        console.log("Vector Store unleashed")
        console.log("Embedded documents on drugs", embedder)

        console.log("Embedder on cocaine", embedder[0])

        // Example: Fetching documents matching the embeddings
        const matchedDocuments = await vectorStore.similaritySearchVectorWithScore(
            embedder[0], 5)
        console.log('Matched Documents:', matchedDocuments);


        const jsonString = JSON.stringify(matchedDocuments);

        console.log("JSON STRINGS",jsonString);
        // const completeJsonString = `[${jsonString}]`;
        const dataArray = JSON.parse(jsonString);
        const pageContents = dataArray.map(item => item[0].pageContent);
        const combinedContent = pageContents.join(' ')
        console.log("Combined multi text",combinedContent);
        const masterPrompt = `Using the following information as context or point of reference   ${matchedDocuments}. Answer the following question: ${masterStandaloneQuestion} .Your answer should feel witty.Response should be five lines .Response should contain humour}`
        
        
        const result = await model.generateContent(masterPrompt);

        const masterAnswer = result.response.text() || 'No response';
        console.log("Master Answer", masterAnswer)
        return masterAnswer




    } catch (error) {
        console.error('Error creating Supabase client:', error);
        throw error;
    }
}



const form = document.querySelector('form')
const chatContainer = document.querySelector('#chat_container')

let loadInterval

function loader(element) {
    element.textContent = ''

    loadInterval = setInterval(() => {
        // Update the text content of the loading indicator
        element.textContent += '.';

        // If the loading indicator has reached three dots, reset it
        if (element.textContent === '....') {
            element.textContent = '';
        }
    }, 300);
}

function typeText(element, text) {
    let index = 0

    let interval = setInterval(() => {
        if (index < text.length) {
            element.innerHTML += text.charAt(index)
            index++
        } else {
            clearInterval(interval)
        }
    }, 20)
}

// generate unique ID for each message div of bot
// necessary for typing text effect for that specific reply
// without unique ID, typing text will work on every element
function generateUniqueId() {
    const timestamp = Date.now();
    const randomNumber = Math.random();
    const hexadecimalString = randomNumber.toString(16);

    return `id-${timestamp}-${hexadecimalString}`;
}

function chatStripe(isAi, value, uniqueId) {
    console.log("Value of ai ", value)
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
    )
}

const handleSubmit = async (e) => {
    e.preventDefault()

    const data = new FormData(form)
console.log("Data", data);
    // user's chatstripe
    chatContainer.innerHTML += chatStripe(false, data.get('prompt'))

    // to clear the textarea input 
    form.reset()

    // bot's chatstripe
    const uniqueId = generateUniqueId()
    chatContainer.innerHTML += chatStripe(true, "esfssdf", uniqueId)

    // to focus scroll to the bottom 
    chatContainer.scrollTop = chatContainer.scrollHeight;

    // specific message div 
    const messageDiv = document.getElementById(uniqueId)

    // messageDiv.innerHTML = "..."
    loader(messageDiv)

    const response = await fetch('https://codex-im0y.onrender.com/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            prompt: data.get('prompt')
        })
    })


    // const response = {
    //     "success": true,
    //     "message": "Request processed successfully",
    //     "data": {
    //         "result": "Here is the output based on the prompt."
    //     }
    // }
    
// const response = "Victory is great"
    clearInterval(loadInterval)
    messageDiv.innerHTML = " retertret"

    if (response.ok) {
        const data = await response.json();
        const parsedData = data.bot.trim() // trims any trailing spaces/'\n' 
// const parsedData = "Victot"
        typeText(messageDiv, parsedData)
    } else {
        const err = await response.text()

        messageDiv.innerHTML = "Something went wrong"
        alert(err)
    }
}

form.addEventListener('submit', handleSubmit)
form.addEventListener('keyup', (e) => {
    if (e.keyCode === 13) {
        handleSubmit(e)
    }
})