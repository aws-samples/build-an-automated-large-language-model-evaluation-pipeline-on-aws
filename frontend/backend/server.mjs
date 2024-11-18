import {
  BedrockRuntimeClient,
  ConverseCommand,
} from "@aws-sdk/client-bedrock-runtime";
import {
  BedrockClient,
  ListFoundationModelsCommand,
} from "@aws-sdk/client-bedrock";

import express from "express";
import multer from "multer";
import cors from "cors";
import fs from "fs";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import {
  BedrockAgentClient,
  CreatePromptCommand,
  CreatePromptVersionCommand,
  GetPromptCommand,
  ListPromptsCommand,
  UpdatePromptCommand,
  ConflictException,
} from "@aws-sdk/client-bedrock-agent"; // ES Modules import

// Handle uncaught exceptions globally
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  // Optionally, you can log the error and choose whether to shut down
  // process.exit(1); // Force shutdown if needed
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  // You can log the reason or handle it appropriately
  // process.exit(1); // Force shutdown if needed
});

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const PORT = 5000;

// Enable CORS
app.use(cors());

const upload = multer({ dest: "uploads/" });

app.post("/upload", upload.single("file"), async (req, res) => {
  const file = req.file;
  const bucketName = req.body.bucketName;
  const keyName = req.body.keyName;
  const region = req.body.region;
  console.log(file, bucketName, keyName, region);

  if (!file || !bucketName || !keyName) {
    return res.status(400).json({ error: "Missing required parameters" });
  }

  const s3client = new S3Client({
    region: region,
  });

  const fileStream = fs.createReadStream(file.path);

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: keyName,
    Body: fileStream,
    ContentType: file.mimetype,
  });

  try {
    const response = await s3client.send(command);
    res.status(200).json({ message: "File uploaded successfully" });
  } catch (err) {
    console.log(err);
    console.log("Failure");

    res.status(500).json({ error: "Error uploading file to S3" });
  }

  fs.unlinkSync(file.path);
});

app.get("/models", async (req, res) => {
  console.log("RECEIVING REQUESTS");
  const region = req.query.region;

  const client = new BedrockClient({
    region: region,
  });
  const command = new ListFoundationModelsCommand({});
  try {
    const response = await client.send(command);

    const models = response.modelSummaries;
    res.status(200).send(models);
  } catch (err) {
    console.log(err);
    res.status(500).send({});
  }
});

app.get("/get_prompt", async (req, res) => {
  const region = req.query.region;

  const client = new BedrockAgentClient({
    region: region,
  });

  const input = {
    // ListPromptsRequest
    // promptIdentifier: "STRING_VALUE",
    maxResults: 100,
    // nextToken: "STRING_VALUE",
  };

  const command = new ListPromptsCommand(input);
  try {
    const response = await client.send(command);
    console.log(response);
    res.status(200).send(response["promptSummaries"]);
  } catch (err) {
    console.log(err);
    res.status(500).send(err);
  }

  // console.log(response)
});

app.get("/get_prompt_by_id", async (req, res) => {
  const id = req.query.id;
  const region = req.query.region;
  console.log(region);

  const client = new BedrockAgentClient({
    region: region,
  });

  const input = {
    // ListPromptsRequest
    promptIdentifier: id,
    // nextToken: "STRING_VALUE",
  };

  console.log(input);
  const command = new GetPromptCommand(input);
  try {
    const response = await client.send(command);
    console.log(response["variants"][0]["inferenceConfiguration"]);
    console.log(response["variants"][0]["templateConfiguration"]);

    console.log(response);
    res.status(200).send(response);
  } catch (err) {
    console.log(err);
    res.status(500).send(err);
  }
});

app.post("/save_prompt", async (req, res) => {
  const data = req.body;

  const region = data["region"];
  const name = data["name"];
  const description = data["description"];
  const prompt = data["prompt"];
  const inputs = data["inputs"];
  const temperature = parseFloat(data["temperature"]);
  const top_k = parseInt(data["top_k"]);
  const top_p = parseFloat(data["top_p"]);
  const max_tokens = parseInt(data["max_tokens"]);
  const stop_sequences = data["stop_sequences"];
  const modelId = data["model_id"];

  const client = new BedrockAgentClient({
    region: region,
  });

  var input;

  if (inputs.length > 0) {
    input = {
      // CreatePromptRequest
      name: name, // required
      description: description,
      variants: [
        // PromptVariantList
        {
          // PromptVariant
          name: name, // required
          templateType: "TEXT", // required
          templateConfiguration: {
            // PromptTemplateConfiguration Union: only one key present
            text: {
              // TextPromptTemplateConfiguration
              text: prompt, // required
              inputVariables: inputs,
            },
          },
          modelId: modelId,
          inferenceConfiguration: {
            text: {
              temperature: temperature,
              topK: top_k,
              topP: top_p,
              maxTokens: max_tokens,
              stopSequences: stop_sequences,
            },
          },
        },
      ],
    };
  } else {
    input = {
      // CreatePromptRequest
      name: name, // required
      description: description,
      variants: [
        // PromptVariantList
        {
          // PromptVariant
          name: name, // required
          templateType: "TEXT", // required
          templateConfiguration: {
            // PromptTemplateConfiguration Union: only one key present
            text: {
              // TextPromptTemplateConfiguration
              text: prompt, // required
            },
          },
          modelId: modelId,
          inferenceConfiguration: {
            text: {
              temperature: temperature,
              topK: top_k,
              topP: top_p,
              maxTokens: max_tokens,
              stopSequences: stop_sequences,
            },
          },
        },
      ],
    };
  }

  console.log(input);
  const command = new CreatePromptCommand(input);
  try {
    const response = await client.send(command);
    const promptVersionCommand = new CreatePromptVersionCommand({
      promptIdentifier: response.id,
      description: response.description ?? ""
    });
    const promptVersionResponse = await client.send(promptVersionCommand);
    res.status(200).send({ id: response.id });
  } catch (err) {
    res.status(500).send({ id: `ERROR: ${err}` });
    console.log(err);
  }
});

app.post("/update_prompt", async (req, res) => {
  const data = req.body;

  const region = data["region"];
  const name = data["name"];
  const description = data["description"];
  const prompt = data["prompt"];
  const inputs = data["inputs"];
  const temperature = parseFloat(data["temperature"]);
  const top_k = parseInt(data["top_k"]);
  const top_p = parseFloat(data["top_p"]);
  const max_tokens = parseInt(data["max_tokens"]);
  const stop_sequences = data["stop_sequences"];
  const modelId = data["model_id"];
  const promptIdentifier = data["prompt_identifier"];

  const client = new BedrockAgentClient({
    region: region,
  });

  var input;

  if (inputs.length > 0) {
    input = {
      // CreatePromptRequest
      name: name, // required
      promptIdentifier: promptIdentifier,
      description: description,
      variants: [
        // PromptVariantList
        {
          // PromptVariant
          name: name, // required
          templateType: "TEXT", // required
          templateConfiguration: {
            // PromptTemplateConfiguration Union: only one key present
            text: {
              // TextPromptTemplateConfiguration
              text: prompt, // required
              inputVariables: inputs,
            },
          },
          modelId: modelId,
          inferenceConfiguration: {
            text: {
              temperature: temperature,
              topK: top_k,
              topP: top_p,
              maxTokens: max_tokens,
              stopSequences: stop_sequences,
            },
          },
        },
      ],
    };
  } else {
    input = {
      // CreatePromptRequest
      name: name, // required
      promptIdentifier: promptIdentifier,
      description: description,
      variants: [
        // PromptVariantList
        {
          // PromptVariant
          name: name, // required
          templateType: "TEXT", // required
          templateConfiguration: {
            // PromptTemplateConfiguration Union: only one key present
            text: {
              // TextPromptTemplateConfiguration
              text: prompt, // required
            },
          },
          modelId: modelId,
          inferenceConfiguration: {
            text: {
              temperature: temperature,
              topK: top_k,
              topP: top_p,
              maxTokens: max_tokens,
              stopSequences: stop_sequences,
            },
          },
        },
      ],
    };
  }

  console.log(input);
  const command = new UpdatePromptCommand(input);
  try {
    const response = await client.send(command);
    const promptVersionCommand = new CreatePromptVersionCommand({
      promptIdentifier: response.id,
      description: response.description ?? ""
    });
    const promptVersionResponse = await client.send(promptVersionCommand);
    res.status(200).send({ id: response.id });
  } catch (err) {
    res.status(500).send({ id: `ERROR: ${err}` });
    console.log(err);
  }
});

app.post("/invoke", async (req, res) => {
  const data = req.body;

  const region = data["region"];
  const modelId = data["modelId"];
  const prompt = data["prompt"];
  const temperature = parseFloat(data["temperature"]);
  const topP = parseFloat(data["top_p"]);
  const maxTokens = parseInt(data["max_tokens"]);
  const topK = parseInt(data["top_k"]);
  const systemPrompt = data["system_prompt"];
  const stopSequences = data["stop_sequences"];

  console.log(data);

  const client = new BedrockRuntimeClient({ region: region });

  // Start a conversation with the user message.
  const conversation = [
    {
      role: "user",
      content: [{ text: prompt }],
    },
  ];

  // Create a command with the model ID, the message, and a basic configuration.
  var command;

  if (systemPrompt == null || systemPrompt == undefined || systemPrompt == "") {
    command = new ConverseCommand({
      modelId,
      messages: conversation,
      inferenceConfig: {
        maxTokens: maxTokens,
        temperature: temperature,
        topP: topP,
        topK: topK,
        stopSequences: stopSequences,
      },
    });
  } else {
    command = new ConverseCommand({
      modelId,
      messages: conversation,
      inferenceConfig: {
        maxTokens: maxTokens,
        temperature: temperature,
        topP: topP,
        topK: topK,
        stopSequences: stopSequences,
      },
      system: [{ text: systemPrompt }],
    });
  }

  try {
    // Send the command to the model and wait for the response
    const response = await client.send(command);

    // Extract and print the response text.
    const responseText = response.output.message.content[0].text;
    res.status(200).send(response);
  } catch (err) {
    res.status(500).send(`ERROR: Can't invoke '${modelId}'. Reason: ${err}`);
    console.log(`ERROR: Can't invoke '${modelId}'. Reason: ${err}`);
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
