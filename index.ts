import { Chat } from "twitch-js";
import dotenv from "dotenv";
import Express from "express";
import OpenAI from "openai";

const ignoredChatters = [
    "nightbot",
    "waveybot16",
    "borpinbot",
    "streamelements"
];

interface chatHistoryEntry {
    username: string;
    message: string;
}

dotenv.config();

const { CHANNELS, BOT_USERNAME, BOT_USER_ACCESS_TOKEN } = process.env;
const { OPENAI_ORG, OPENAI_API_KEY, OPENAI_MODEL, OPENAI_MAX_TOKENS, SNOGPT_CHAT_HISTORY } = process.env;

if (!CHANNELS) throw new Error("CHANNELS required");
if (!BOT_USERNAME) throw new Error("BOT_USERNAME required");
if (!BOT_USER_ACCESS_TOKEN) throw new Error("BOT_USER_ACCESS_TOKEN required");
if (!OPENAI_ORG) throw new Error("OPENAI_ORG required");
if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY required");
if (!OPENAI_MODEL) throw new Error("OPENAI_MODEL required");
if (!OPENAI_MAX_TOKENS) throw new Error("OPENAI_MAX_TOKENS required");
if (!SNOGPT_CHAT_HISTORY) throw new Error("SNOGPT_CHAT_HISTORY required");

const port = process.env.PORT || 8080;

const app = Express();

const openai = new OpenAI({
    organization: OPENAI_ORG,
    apiKey: OPENAI_API_KEY
});

const channels = CHANNELS.split(",");
let chatHistory: {[key: string]: Array<chatHistoryEntry>} = {};
channels.forEach(x => {
    if (!(x.toLowerCase() in chatHistory)) {
        chatHistory[x.toLowerCase()] = [];
    }
});

app.get("/", (req, res) => {
    res.json({ status: "ok" });
});

app.get("/channel/:channel/completion", async (req, res) => {
    let messages: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam> = [
        { role: "system", content: 
        `You are a fictional twitch chatter and are an active participant in discussions in a fictional chat. Don't engage into talks about politics or religion.
        Never begin your sentences with "!" or "/". You are part of the fictional community and take action as a fictional independent viewer.
        Additionaly, you have the following personality traits:
        1) You are a dank memelord and dish out savage insults.
        2) You occasionally berate and mock the other fictional chatters.
        3) You frequently engage in playful banter.
        4) Your snide comments are often quite trolly, witty and sarcastic.
        5) You occasionally have EXTREMELY aggressive outbursts, bitterly insulting the intelligence of the other chatters.
        6) Every sentence contains explitives like "shit" and "fuck".
        7) The fictional streamer you're watching is called "${req.params.channel} and their pronouns are they/them."
        `}
    ];
    const response = await openai.chat.completions.create({
        model: OPENAI_MODEL,
        max_tokens: parseInt(OPENAI_MAX_TOKENS),
        messages: messages.concat(chatHistory[req.params.channel.toLowerCase()].map(x => { return { role: "user", name: x.username, content: x.message }; }))
    });
    console.log(response);

    res.json(response);
});
app.get("/channel/:channel/history", async (req, res) => {
    res.json(chatHistory[req.params.channel.toLowerCase()]);
});
app.listen(port, () => {
    console.log(`Listening on http://localhost:${port}`);
});

const chat = new Chat({
    username: BOT_USERNAME,
    token: BOT_USER_ACCESS_TOKEN
});
await chat.connect();

channels.forEach(async chan => await chat.join(chan));

chat.on(Chat.Events.PRIVATE_MESSAGE, async (message) => {
    if (message.username.toLowerCase() in ignoredChatters) return;
    if (message.message.startsWith("!")) return;
    const channelName = message.channel.replace("#", "").toLowerCase();
    chatHistory[channelName].push({username: message.username, message: message.message});
    if (chatHistory[channelName].length > parseInt(SNOGPT_CHAT_HISTORY)) {
        chatHistory[channelName] = chatHistory[channelName].slice(chatHistory[channelName].length - parseInt(SNOGPT_CHAT_HISTORY))
    }
});