import {
  evaluationMetricsMap,
  URL,
  API_URL,
  defaultMaxTokens,
  defaultStopSequences,
  defaultTemperature,
  defaultTopK,
  defaultTopP,
} from "./constants";

import Button from "@mui/material/Button";

export async function getModels(
  region,
  setModelMap,
  setAvailableModels,
  setdialogMessage,
  setshowDialog,
) {
  try {
    const res = await fetch(
      `${API_URL}/models?region=${encodeURIComponent(region)}`,
    );
    const data = await res.text();

    if (res.status != 200) {
      setdialogMessage(data);
      setshowDialog(true);
      return;
    }

    const models = JSON.parse(data);
    const activeModels = models.filter(
      (m) =>
        m.modelLifecycle.status === "ACTIVE" &&
        m.inferenceTypesSupported.includes("ON_DEMAND") &&
        m.inputModalities.includes("TEXT") &&
        m.outputModalities.includes("TEXT"),
    );
    const idToNameMap = activeModels.reduce((map, model) => {
      map[model.modelName] = model.modelId;
      return map;
    }, {});

    setModelMap(idToNameMap);
    setAvailableModels(Object.keys(idToNameMap));
  } catch (error) {
    console.log(error);
    setdialogMessage("Error while fetching models. API running?");
    setshowDialog(true);
    return;
  }
}

export async function callBedRock(
  modelId,
  prompt,
  region,
  modelMap,
  temperature,
  top_p,
  top_k,
  max_tokens,
  systemPrompt,
  stopSequences,
  setdialogMessage,
  setshowDialog,
) {
  try {
    const payload = {
      region: region,
      modelId: modelMap[modelId],
      prompt: prompt,
      temperature: temperature,
      top_p: top_p,
      top_k: top_k,
      max_tokens: max_tokens,
      system_prompt: systemPrompt,
      stop_sequences: stopSequences,
    };

    const res = await fetch(API_URL + "/invoke", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await res.text();
    if (res.status != 200) {
      setdialogMessage(data);
      setshowDialog(true);
      return ["", 0, 0];
    }
    const parsedData = JSON.parse(data);
    return [
      parsedData["output"]["message"]["content"][0]["text"],
      parsedData["usage"],
      parsedData["metrics"]["latencyMs"],
    ];
  } catch (error) {
    console.log(error);
    setdialogMessage("Error while invoking model. API running?");
    setshowDialog(true);
    return ["", 0, 0];
  }
}

export async function invokeLLM(
  region,
  selectedModel,
  modelMap,
  s3bucket,
  s3FileName,
  setdialogMessage,
  setshowDialog,
  setinvokeARN,
  isChecked,
  selectedPromptId,
) {
  const url = URL; // Replace with the actual URL

  // This link is to monitor the state of the step functions
  const LinkURL =
    "https://" +
    region +
    ".console.aws.amazon.com/states/home?region=" +
    region +
    "#/v2/executions/details/";

  var method = "native";
  if (isChecked) {
    method = "kb";
  }

  const payload = {
    operation: "invoke",
    model_family: "bedrock",
    model_name: modelMap[selectedModel],
    question_bucket: s3bucket,
    question_key: s3FileName,
    method: method,
    prompt_id: selectedPromptId !== "" ? selectedPromptId : null,
  };
  console.log(payload);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.log(response);
      setdialogMessage("Generation Failed! Please try again");
      setshowDialog(true);
    }

    const result = await response.json();
    const arn = result["executionArn"];
    const link = LinkURL + arn;
    setinvokeARN(arn.substring(arn.lastIndexOf(":") + 1));

    // setdialogMessage(<a href={link} target="_blank" rel="noopener noreferrer">Job Sumitted!</a>)
    setdialogMessage(
      <Button color="success" variant="contained" href={link} target="_blank">
        Generation Job Sumitted!
      </Button>,
    );

    setshowDialog(true);
  } catch (error) {
    setdialogMessage("Generation Failed! Please try again");
    setshowDialog(true);
    console.error("Error:", error);
  }
}

export const runEvaluation = async (
  region,
  modelMap,
  selectedModel,
  setdialogMessage,
  setshowDialog,
  s3bucket,
  invokeARN,
  selectedMetrics,
  evaluationFileLocation,
) => {
  // This link is to monitor the state of the step functions
  const LinkURL =
    "https://" +
    region +
    ".console.aws.amazon.com/states/home?region=" +
    region +
    "#/v2/executions/details/";

  const url = URL; // Replace with the actual URL
  const payload = {
    operation: "evaluate",
    evaluation_model_family: "bedrock",
    evaluation_model_name: modelMap[selectedModel],
    evaluation_location: evaluationFileLocation,
    // evaluation_location:
    //   "s3://" +
    //   s3bucket +
    //   "/invoke_successful_result/jsonline/" +
    //   invokeARN +
    //   "/result.jsonl",
    instance_type: "ml.m5.xlarge",
    evaluation_metrics: selectedMetrics.map((key) => evaluationMetricsMap[key]),
    method: "ragaseval",
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      setdialogMessage("Evaluation Failed! Please try again");
      setshowDialog(true);
    }

    const result = await response.json();
    const link = LinkURL + result["executionArn"];

    setdialogMessage(
      <Button color="success" variant="contained" href={link} target="_blank">
        Evaluation Job Sumitted!
      </Button>,
    );
    setshowDialog(true);
  } catch (error) {
    setdialogMessage("Evaluation Failed! Please try again");
    setshowDialog(true);
    console.error("Error:", error);
  }
};

export const getPrompts = async (
  region,
  setPrompts,
  setdialogMessage,
  setshowDialog,
) => {
  try {
    const response = await fetch(
      `${API_URL}/get_prompt?region=${encodeURIComponent(region)}`,
    );

    if (!response.ok) {
      console.log(response);
    }

    const result = await response.json();
    // const promptList = result.map(item => item.name)
    setPrompts(result);
    return result;
  } catch (error) {
    setdialogMessage("Error while fetching prompts. API running?");
    setshowDialog(true);
    console.error("Error:", error);
    return [];
  }
};

export const getPromptById = async (
  region,
  promptName,
  prompts,
  setPromptTemplate,
  setTemperature,
  setTopP,
  setMaxTokens,
  setStopSequences,
  setSelectedPromptId,
) => {
  const selectedPromptId = prompts.filter((item) => item.name === promptName);
  try {
    const response = await fetch(
      `${API_URL}/get_prompt_by_id?region=${encodeURIComponent(region)}&id=${encodeURIComponent(selectedPromptId[0]["id"])}`,
    );

    if (!response.ok) {
      console.log(response);
    }
    const result = await response.json();

    setPromptTemplate(
      result["variants"][0]["templateConfiguration"]["text"]["text"],
    );
    setTemperature(
      result["variants"][0]["inferenceConfiguration"]["text"]["temperature"],
    );
    setTopP(result["variants"][0]["inferenceConfiguration"]["text"]["topP"]);
    setStopSequences(
      result["variants"][0]["inferenceConfiguration"]["text"]["stopSequences"],
    );
    setMaxTokens(
      result["variants"][0]["inferenceConfiguration"]["text"]["maxTokens"],
    );

    setSelectedPromptId(result["id"]);
  } catch (error) {
    console.error("Error:", error);
  }
};

export const resetPrompt = async (
  setPromptTemplate,
  setTemperature,
  setTopP,
  setTopK,
  setMaxTokens,
  setStopSequences,
  setSelectedPromptId,
) => {
  setPromptTemplate("");
  setTemperature(defaultTemperature);
  setTopP(defaultTopP);
  setMaxTokens(defaultMaxTokens);
  setStopSequences(defaultStopSequences);
  setTopK(defaultTopK);
  setSelectedPromptId("");
};
