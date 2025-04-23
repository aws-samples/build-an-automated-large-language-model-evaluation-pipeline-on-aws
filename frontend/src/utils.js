const modelCost = {
  "Claude 3 Haiku": { input: 0.00025, output: 0.00125 },
  "Claude 3.5 Haiku": { input: 0.0008, output: 0.004 },
  "Claude 3 Sonnet": { input: 0.003, output: 0.015 },
  "Claude 3.5 Sonnet": { input: 0.003, output: 0.015 },
  "Claude 3.5 Sonnet v2": { input: 0.003, output: 0.015 },
  "Claude 3.5 Sonnet v2": { input: 0.003, output: 0.015 },
  "Claude 3.7 Sonnet": { input: 0.003, output: 0.015 },
  "Nova Lite": { input: 0.00006, output: 0.00024 },
  "Nova Micro": { input: 0.000035, output: 0.00014 },
  "Nova Pro": { input: 0.0008, output: 0.0032 },
  "Llama 3 8B Instruct": {input:0.0003, output:0.0006},
  "Llama 3 70B Instruct": {input:0.00265, output:0.0035},

  "Llama 3.1 8B Instruct": {input:0.00022, output:0.00022},
  "Llama 3.1 70B Instruct": {input:0.00072, output:0.00072},
  "Llama 3.1 405B Instruct": {input:0.0024, output:0.0024},
  
  "Llama 3.2 1B Instruct": {input:0.0001, output:0.0001},
  "Llama 3.2 3B Instruct": {input:0.00015, output:0.00015},
  "Llama 3.2 11B Instruct": {input:0.00016, output:0.00016},
  "Llama 3.2 90B Instruct": {input:0.00072, output:0.00072},

  "Llama 3.3 70B Instruct": {input:0.00072, output:0.00072},
  "Mistral 7B Instruct": {input: 0.00015, output:0.0002},
  "Mistral Large (24.02)": {input: 0.004, output:0.012},
  "Mistral Large (24.07)": {input: 0.002, output:0.006},
  "Mixtral 8x7B Instruct": {input:0.00045	 , output:0.0007}

  
};

export function replacePlaceholders(template, values) {
  return template.replace(/{{(\w+)}}/g, (match, key) => {
    const valueObject = values.find((obj) => obj.variable === key);
    return valueObject ? valueObject.value : match;
  });
}

export function computeCost(result, model) {
  var cost = 0;
  try {
    cost =
      (modelCost[model]["input"] * result["inputTokens"]) / 1000 +
      (modelCost[model]["output"] * result["outputTokens"]) / 1000;
  } catch (e) {
    console.log(e);
  }
  return cost;
}
