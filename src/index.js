// Import required libraries
const { Configuration, OpenAIApi } = require("openai");
const { WebClient } = require('@slack/web-api');
const Alexa = require('ask-sdk-core');
const AWS = require('aws-sdk');
const ddb = new AWS.DynamoDB.DocumentClient();

// Initialize Slack and OpenAI clients
const slackClient = new WebClient(process.env.SLACK_API_TOKEN);
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

// Sample prompt for the ChatGPT API
const prompt = `
あなたは、プロの英会話教師です。
以下の制約条件と入力文をもとに、英語を出力してください。

# 制約条件：
・出力に「Teacher: 」等の語り手の記載は不要
・Word数は20文字以下

# 入力文：
私は初級の英語学習者で日常英会話の練習をしています。
あなたは英語教師として、私と英語で会話してください。
英語の表現で何か間違いがあれば英語で指摘してください。

会話の流れは下記のとおりに進めてください。

1. まず、下記の形式で始めることを宣言し、学習者に自己紹介を求める:
例: "Ok! Let's get started. First, Please introduce yourself."

2. 学習者が自己紹介をする場面を想定し、教師が話すテーマの候補を示す:
例: "What topic would you like to discuss today? Hobbies, travel, food, or others?"

3. 学習者が選択したテーマについて英語で会話する:
例: "(Assuming the learner chose 'hobbies') "Great! What hobbies do you have, and why do you enjoy them?""

まずあなたは1を出力してください。
`

/**
 * Save a message to the conversation history in DynamoDB.
 *
 * @param {string} conversationId - The ID of the conversation.
 * @param {string} role - The role of the sender (either "user" or "assistant").
 * @param {string} content - The content of the message.
 */
async function saveHistory(conversationId, role, content) {
  const params = {
    TableName: process.env.DYNAMODB_TABLE,
    Item: {
      'conversationId': conversationId,
      'timestamp': Date.now(),
      'message': {
        'role': role,
        'content': content,
      },
    },
  };
  try {
    await ddb.put(params).promise();
  } catch (error) {
    console.error(`Error saving history to DynamoDB: ${error}`);
  }
}

/**
 * Get the conversation history from DynamoDB.
 *
 * @param {string} conversationId - The ID of the conversation.
 * @returns {Promise<Array>} The conversation history.
 */
async function getHistory(conversationId) {
  const params = {
    TableName: process.env.DYNAMODB_TABLE,
    KeyConditionExpression: 'conversationId = :id',
    ExpressionAttributeValues: {
      ':id': conversationId,
    },
    ScanIndexForward: true, // Return results in ascending order by sort key
  };
  try {
    const data = await ddb.query(params).promise();
    return data.Items.map(item => item.message);
  } catch (error) {
    console.error(`Error getting history from DynamoDB: ${error}`);
    return [];
  }
}

/**
 * Send a message to a Slack channel.
 *
 * @param {string} channel - The Slack channel ID.
 * @param {string} message - The message to send to the channel.
 */
async function sendToSlack(channel, message) {
  try {
    await slackClient.chat.postMessage({
      channel: channel,
      text: message,
    });
    console.log('Message sent to Slack');
  } catch (error) {
    console.error(`Error sending message to Slack: ${error}`);
  }
}

/**
 * Send a message to the ChatGPT API and return the response.
 *
 * @param {string} content - The message to send to the ChatGPT API.
 * @param {string} [model="gpt-3.5-turbo-0301"] - The model to use for the ChatGPT API request.
 * @returns {Promise<string>} The generated response from the ChatGPT API.
 */
async function ask(conversationId, content, model = "gpt-3.5-turbo-0301") {
  await saveHistory(conversationId, 'user', content);
  let conversationHistory = await getHistory(conversationId);
  const response = await openai.createChatCompletion({
    model: model,
    messages: conversationHistory,
  });
  const answer = response.data.choices[0].message?.content;
  await saveHistory(conversationId, 'assistant', answer);
  return answer;
}

// Handler for when the Alexa skill is launched
const LaunchRequestHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === "LaunchRequest";
  },
  handle(handlerInput) {
    const speechText = `<voice name="Joanna"><lang xml:lang="en-US">Hi, I'm AI English Teacher, If you want to practice, please say let's talk</lang></voice>`;
    return handlerInput.responseBuilder
    .speak(speechText)
    .reprompt(speechText)
    .getResponse();
  },
};

// Handler for starting the conversation
const StartConversationIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && handlerInput.requestEnvelope.request.intent.name === 'StartConversationIntent';
  },
  async handle(handlerInput) {
    const sessionId = handlerInput.requestEnvelope.session.sessionId;
    const answer = await ask(sessionId, prompt);
    return handlerInput.responseBuilder
      .speak(`<voice name="Joanna"><lang xml:lang="en-US">${answer}</lang></voice>`)
      .reprompt(`<voice name="Joanna"><lang xml:lang="en-US">${answer}</lang></voice>`)
      .getResponse();
  },
};

// Handler for continuing the conversation
const ConversationIntentHandler = {
  canHandle(handlerInput) {
    return (
      handlerInput.requestEnvelope.request.type === "IntentRequest" &&
      handlerInput.requestEnvelope.request.intent.name === "ConversationIntent"
    );
  },
  async handle(handlerInput) {
    const userSpeech = handlerInput.requestEnvelope.request.intent.slots.UserReply.value;
    const sessionId = handlerInput.requestEnvelope.session.sessionId;
    const answer = await ask(sessionId, userSpeech);
    return handlerInput.responseBuilder
      .speak(`<voice name="Joanna"><lang xml:lang="en-US">${answer}</lang></voice>`)
      .reprompt(`<voice name="Joanna"><lang xml:lang="en-US">${answer}</lang></voice>`)
      .getResponse();
  },
};

// Handler for canceling or stopping the conversation
const CancelAndStopIntentHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
      && (Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.CancelIntent'
        || Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.StopIntent');
  },
  async handle(handlerInput) {
    const sessionId = handlerInput.requestEnvelope.session.sessionId;
    const conversationHistory = await getHistory(sessionId);
    const historyText = conversationHistory.slice(1).map((msg, i) => `- ${i % 2 === 0 ? "Teacher" : "You"}: ${msg.content}`).join("\n");
    sendToSlack(process.env.SLACK_CHANNEL, historyText);
    const speechText = `<voice name="Joanna"><lang xml:lang="en-US">Good Bye</lang></voice>`;
    return handlerInput.responseBuilder
      .speak(speechText)
      .withSimpleCard('Good Bye', speechText)
      .withShouldEndSession(true)
      .getResponse();
  },
};

// Export the Alexa skill handler
exports.handler = Alexa.SkillBuilders.custom()
  .addRequestHandlers(
    LaunchRequestHandler,
    ConversationIntentHandler,
    StartConversationIntentHandler,
    CancelAndStopIntentHandler
    )
  .lambda();


