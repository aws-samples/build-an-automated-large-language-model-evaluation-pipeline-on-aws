import React, { useState, useEffect, useCallback, memo } from "react";
import {
  evaluationMetricsMap,
  columns,
  API_URL,
  defaultTemperature,
  defaultMaxTokens,
  defaultStopSequences,
  defaultTopK,
  defaultTopP,
} from "./constants";
import { replacePlaceholders, computeCost } from "./utils";
import {
  callBedRock,
  runEvaluation,
  invokeLLM,
  getModels,
  getPrompts,
  getPromptById,
  resetPrompt,
} from "./functions";
import { CustomDrawer } from "./drawer";
import { createTheme, ThemeProvider, styled } from "@mui/material/styles";

import {
  CssBaseline,
  Container,
  Grid,
  Typography,
  TextField,
  Select,
  MenuItem,
  Button,
  Divider,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Tab,
  Box,
  InputLabel,
  CircularProgress,
  FormControl,
} from "@mui/material";
import { blue, amber, orange } from "@mui/material/colors";

import { DataGrid } from "@mui/x-data-grid";
import "./App.css";
import Snackbar from "@mui/material/Snackbar";

import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import logoImage from "./logo.svg"; // Relative import of the image

import TransitionsModal from "./prompt_modal";
import { Chip } from "@mui/material";

const theme = createTheme({
  palette: {
    primary: blue,
    secondary: amber,
    background: {
      default: "#fcfcfa",
      paper: "#ffffff",
    },
  },
  mixins: {
    MuiDataGrid: {
      // Pinned columns sections
      pinnedBackground: "#340606",
      // Headers, and top & bottom fixed rows
      containerBackground: "#343434",
    },
  },
});

function App() {
  const [model1, setModel1] = useState("");
  const [model2, setModel2] = useState("");
  const [output1, setOutput1] = useState("");
  const [output2, setOutput2] = useState("");
  const [template, setTemplate] = useState("");
  const [tabValue, setTabValue] = useState(0);
  const [contextData, setContextData] = useState([{ variable: "", value: "" }]);
  const [selectedModel, setSelectedModel] = useState("");
  const [selectedEvalModel, setSelectedEvalModel] = useState("");
  const [selectedMetrics, setSelectedMetrics] = useState([]);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [region, setRegion] = useState("us-west-2");
  const [availableModels, setAvailableModels] = useState([]);
  const [modelMap, setModelMap] = useState({});
  const [s3bucket, sets3bucket] = useState("");
  const [s3bucketFile, sets3bucketFile] = useState("");

  const [snackBarOpen, setsnackBarOpen] = useState(false);
  const [snackbarMessage, setsnackbarMessage] = useState("");
  const [showDialog, setshowDialog] = useState(false);
  const [dialogMessage, setdialogMessage] = useState("");
  const [invokeARN, setinvokeARN] = useState("");
  const [isChecked, setIsChecked] = useState(false);

  const [temperature, setTemperature] = useState(defaultTemperature);
  const [top_p, setTopP] = useState(defaultTopP);
  const [top_k, setTopK] = useState(defaultTopK);
  const [max_tokens, setMaxTokens] = useState(defaultMaxTokens);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [inputValue, setInputValue] = useState("");
  const [stopSequences, setStopSequences] = useState(defaultStopSequences);
  const [prompts, setPrompts] = useState([]);
  const [selectedPrompt, setSelectedPrompt] = useState("");
  const [selectedPromptId, setSelectedPromptId] = useState("");
  const [batchGenerationPromptId, setBatchGenerationPromptId] = useState("");
  const [evaluationFileLocation, setEvaluationFileLocation] = useState("");

  const StopSequences = () => {
    const handleAdd = () => {
      if (inputValue.trim() && !stopSequences.includes(inputValue)) {
        setStopSequences([...stopSequences, inputValue]);
        setInputValue("");
      }
    };

    const handleDelete = (sequenceToDelete) => {
      setStopSequences(stopSequences.filter((seq) => seq !== sequenceToDelete));
    };

    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <TextField
          label="Stop sequences"
          variant="outlined"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          size="small"
        />
        <Button variant="contained" onClick={handleAdd}>
          Add
        </Button>
        <Box
          sx={{
            display: "flex",
            gap: 1,
            flexWrap: "wrap",
            marginTop: "20px",
            marginLeft: "10px",
          }}
        >
          {stopSequences.map((sequence) => (
            <Chip
              key={sequence}
              label={sequence}
              onDelete={() => handleDelete(sequence)}
              color="primary"
            />
          ))}
        </Box>
      </Box>
    );
  };

  const regions = ["ap-southeast-2", "us-east-1", "us-west-2"];

  useEffect(() => {
    getModels(
      region,
      setModelMap,
      setAvailableModels,
      setdialogMessage,
      setshowDialog,
    );
  }, []);

  useEffect(() => {
    getPrompts(region, setPrompts, setdialogMessage, setshowDialog);
  }, []);

  const handleModel1Change = useCallback((event) => {
    setModel1(event.target.value);
  }, []);

  const handleModel2Change = useCallback((event) => {
    setModel2(event.target.value);
  }, []);

  async function uploadS3(data) {
    const formData = new FormData();
    formData.append("file", data);
    formData.append("bucketName", s3bucket);
    formData.append("keyName", s3bucketFile);
    formData.append("region", region);
    try {
      const response = await fetch(`${API_URL}/upload`, {
        method: "POST",
        body: formData,
      });
      // const data = await response.json();
      if (response.ok) {
        setsnackbarMessage("File Upload Successful!");
        setsnackBarOpen(true);
      } else {
        setsnackbarMessage("File Upload Failed!");
        setsnackBarOpen(true);
        // alert(`Error: ${data.message}`);
      }
    } catch (error) {
      setsnackbarMessage("File Upload Failed!");
      setsnackBarOpen(true);
    }
  }

  const runModels = async () => {
    // const credentials = fromIni()
    // credentials: fromIni
    setLoading(true);
    const formattedValue = replacePlaceholders(template, contextData);

    const [result1, result2] = await Promise.all([
      callBedRock(
        model1,
        formattedValue,
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
      ),

      callBedRock(
        model2,
        formattedValue,
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
      ),
    ]);
    const [model1_response, usageModel1, latency1] = result1;
    const [model2_response, usageModel2, latency2] = result2;

    const model1Cost = computeCost(usageModel1, model1);
    const model2Cost = computeCost(usageModel2, model2);

    setRows([
      {
        id: 1,
        Model: model1,
        Latency: `${latency1.toFixed(2)} ms`,
        Cost: `$${model1Cost.toFixed(5)}`,
      },
      {
        id: 2,
        Model: model2,
        Latency: `${latency2.toFixed(2)} ms`,
        Cost: `$${model2Cost.toFixed(5)}`,
      },
    ]);

    setLoading(false);
    setOutput1(model1_response);
    setOutput2(model2_response);
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />

      <div style={{ overflow: "auto" }}>
        <Dialog
          open={showDialog}
          onClose={(e) => setshowDialog(false)}
          aria-labelledby="alert-dialog-title"
          aria-describedby="alert-dialog-description"
        >
          <DialogContent>
            <DialogContentText id="alert-dialog-description">
              {dialogMessage}
            </DialogContentText>
          </DialogContent>
          <DialogActions></DialogActions>
        </Dialog>
        {CustomDrawer(
          region,
          setRegion,
          regions,
          setModelMap,
          setPrompts,
          setAvailableModels,
          setdialogMessage,
          setshowDialog,
        )}

        <Container maxWidth="lg">
          <Grid container spacing={0} alignItems="center">
            <Grid item xs={5} align="right">
              <Container fullWidth>
                <img
                  src={logoImage}
                  alt="Your Alt Text"
                  style={{ width: "50%", height: "auto" }}
                />
              </Container>
            </Grid>
            <Grid item xs={7} align="left" alignItems="left">
              <Typography
                variant="h2"
                align="left"
                gutterBottoms
                color="secondary"
                gutterBottom="true"
              >
                GenAI Eval 🗝️
              </Typography>
            </Grid>
          </Grid>

          <Grid container spacing={3}>
            <Grid item xs={6}>
              <Typography variant="h4">Model 1</Typography>
              <Select
                sx={{ marginTop: "5px" }}
                variant="standard"
                fullWidth
                value={model1}
                onChange={handleModel1Change}
                displayEmpty
              >
                <MenuItem value="" disabled>
                  Select model 1
                </MenuItem>
                {availableModels.map((model) => (
                  <MenuItem key={model} value={model}>
                    {model}
                  </MenuItem>
                ))}
              </Select>
              <TextField
                fullWidth
                multiline
                minRows={8}
                maxRows={24}
                variant="outlined"
                margin="normal"
                label="Model 1 output"
                value={output1}
                onChange={(e) => setOutput1(e.target.value)}
                color="secondary"
                sx={{
                  "& .MuiInputBase-root": {
                    backgroundColor: "white", // Set your desired background color here
                  },
                }}
              />
            </Grid>
            <Grid item xs={6}>
              <Typography variant="h4">Model 2</Typography>
              <Select
                sx={{ marginTop: "5px" }}
                variant="standard"
                fullWidth
                value={model2}
                onChange={(e) => setModel2(e.target.value)}
                displayEmpty
              >
                <MenuItem value="" disabled>
                  Select model 2
                </MenuItem>
                {availableModels.map((model) => (
                  <MenuItem key={model} value={model}>
                    {model}
                  </MenuItem>
                ))}
              </Select>
              <TextField
                fullWidth
                multiline
                minRows={8}
                maxRows={24}
                variant="outlined"
                margin="normal"
                label="Model 2 output"
                value={output2}
                onChange={handleModel2Change}
                color="secondary"
                sx={{
                  "& .MuiInputBase-root": {
                    backgroundColor: "white", // Set your desired background color here
                  },
                }}
              />
            </Grid>
          </Grid>

          <Box mt={3}>
            <Tabs
              value={tabValue}
              onChange={(e, newValue) => setTabValue(newValue)}
            >
              <Tab label="Prompt Template" />
              <Tab label="Context" />
              {/* <Tab label="System Prompt" />  */}
              <Tab label="Generation Configuration" />
            </Tabs>
            <div style={{ height: "10px" }} />
            <Box mt={2}>
              {tabValue === 0 && (
                <Grid container spacing={2}>
                  <Grid item xs={7}>
                    <Select
                      sx={{ marginTop: "5px", marginBottom: "20px" }}
                      variant="standard"
                      fullWidth
                      value={selectedPrompt}
                      onChange={(e) => {
                        setSelectedPrompt(e.target.value);
                        getPromptById(
                          region,
                          e.target.value,
                          prompts,
                          setTemplate,
                          setTemperature,
                          setTopP,
                          setMaxTokens,
                          setStopSequences,
                          setSelectedPromptId,
                        );
                      }}
                      displayEmpty
                    >
                      <MenuItem value="" disabled>
                        Select Prompt or Create New
                      </MenuItem>
                      {prompts.map((model) => (
                        <MenuItem key={model["name"]} value={model["name"]}>
                          {model["name"]}
                        </MenuItem>
                      ))}
                    </Select>
                  </Grid>
                  <Grid item xs={4}>
                    <TextField
                      label="Prompt ID"
                      fullWidth
                      value={selectedPromptId}
                    ></TextField>
                  </Grid>
                  <Grid item xs={1}>
                    <Button
                      variant="contained"
                      color="primary"
                      fullWidth
                      // onClick={() => setTemplate("")}
                      onClick={() => {
                        resetPrompt(
                          setTemplate,
                          setTemperature,
                          setTopP,
                          setTopK,
                          setMaxTokens,
                          setStopSequences,
                          setSelectedPromptId,
                        );
                        setSelectedPrompt("");
                      }}
                    >
                      Reset
                    </Button>
                  </Grid>
                  <Grid item xs={11}>
                    <TextField
                      fullWidth
                      multiline
                      minRows={4}
                      variant="outlined"
                      label="Template"
                      value={template}
                      onChange={(e) => setTemplate(e.target.value)}
                      sx={{
                        "& .MuiInputBase-root": {
                          backgroundColor: "white", // Set your desired background color here
                        },
                      }}
                    />
                  </Grid>
                  <Grid item xs={1}>
                    <Button
                      variant="contained"
                      color="primary"
                      fullWidth
                      onClick={runModels}
                      disabled={loading}
                    >
                      {loading ? <CircularProgress size={24} /> : "Enter"}
                    </Button>
                    {/* <Button
                      variant="contained"
                      color="secondary"
                      fullWidth
                      style={{ marginTop: "10px" }}
                    >
                      Save
                    </Button> */}
                    <TransitionsModal
                      region={region}
                      template={template}
                      contextData={contextData}
                      temperature={temperature}
                      top_p={top_p}
                      top_k={top_k}
                      max_tokens={max_tokens}
                      stop_sequences={stopSequences}
                      availableModels={availableModels}
                      modelMap={modelMap}
                      selectedPrompt={selectedPrompt}
                      setSelectedPrompt={setSelectedPrompt}
                      setSelectedPromptId={setSelectedPromptId}
                      prompts={prompts}
                      setPrompts={setPrompts}
                      showDialog={setshowDialog}
                      setDialogMsg={setdialogMessage}
                    ></TransitionsModal>
                  </Grid>
                </Grid>
              )}
              {tabValue === 1 && (
                <TableContainer component={Paper}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Variable</TableCell>
                        <TableCell>Value</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {contextData.map((row, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <TextField
                              variant="standard"
                              fullWidth
                              value={row.variable}
                              onChange={(e) => {
                                const newData = [...contextData];
                                newData[index].variable = e.target.value;
                                setContextData(newData);
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <TextField
                              fullWidth
                              variant="standard"
                              value={row.value}
                              onChange={(e) => {
                                const newData = [...contextData];
                                newData[index].value = e.target.value;
                                setContextData(newData);
                              }}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <Button
                    variant="contained"
                    component="span"
                    color="primary"
                    sx={{ marginBlock: "20px" }}
                    fullWidth
                    onClick={() =>
                      setContextData([
                        ...contextData,
                        { variable: "", value: "" },
                      ])
                    }
                  >
                    Add Row
                  </Button>
                </TableContainer>
              )}

              {/* {tabValue===2 && (
                <TextField
                fullWidth
                multiline
                minRows={4}
                variant="outlined"
                label="System Prompt"
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                sx={{
                  '& .MuiInputBase-root': {
                    backgroundColor: 'white', // Set your desired background color here
                  },
                }}
              />
              )} */}
              {tabValue === 2 && (
                <Box
                  sx={{
                    borderRadius: 1,
                    padding: "20px",
                    border: "1px solid #000",
                  }}
                >
                  <Grid container spacing={1}>
                    <Grid item xs={3}>
                      <TextField
                        required
                        onChange={(e) => setTemperature(e.target.value)}
                        id="outlined-required"
                        label="Temperature"
                        defaultValue={temperature}
                      />
                    </Grid>
                    <Grid item xs={3}>
                      <TextField
                        required
                        onChange={(e) => setTopP(e.target.value)}
                        id="outlined-required"
                        label="Top p"
                        defaultValue={top_p}
                      />
                    </Grid>
                    <Grid item xs={3}>
                      <TextField
                        required
                        onChange={(e) => setTopK(e.target.value)}
                        id="outlined-required"
                        label="Top K"
                        defaultValue={top_k}
                      />
                    </Grid>
                    <Grid item xs={3}>
                      <TextField
                        required
                        id="outlined-required"
                        onChange={(e) => setMaxTokens(e.target.value)}
                        label="Max Tokens"
                        defaultValue={max_tokens}
                      />
                    </Grid>

                    <Grid item xs={8}>
                      {StopSequences()}
                    </Grid>
                  </Grid>
                </Box>
              )}
            </Box>
          </Box>

          <Divider style={{ margin: "20px 0" }} />

          <div
            style={{ height: 250, width: "100%", marginBottom: "40px" }}
            fullWidth
          >
            <DataGrid
              rows={rows}
              minRows={5}
              columns={columns}
              hideFooterPagination
              initialState={{
                pagination: {
                  paginationModel: { page: 0, pageSize: 2 },
                },
              }}
            />
          </div>
          <Divider style={{ margin: "20px 0" }} />

          <Typography variant="h4" gutterBottom>
            Batch Generation
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Select
                fullWidth
                value={selectedModel}
                size="medium"
                onChange={(e) => setSelectedModel(e.target.value)}
                displayEmpty
              >
                <MenuItem value="" disabled>
                  Select model
                </MenuItem>
                {availableModels.map((model) => (
                  <MenuItem key={model} value={model}>
                    {model}
                  </MenuItem>
                ))}
              </Select>
            </Grid>
          </Grid>
          {/* <Box display="flex" alignItems="center" fullWidth> */}
          <Grid container spacing={3} sx={{ marginTop: "5px" }}>
            <Grid item xs={3}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={isChecked}
                    onChange={(e) => setIsChecked(e.target.checked)}
                    color="primary"
                  />
                }
                label="Use Knowledge Base"
              />
            </Grid>
            <Grid item xs={3}>
              <Box
                display="flex"
                justifyContent="flex-end" // Aligns the TextField to the right
                fullWidth
              >
                <TextField
                  variant="outlined"
                  size="small"
                  fullWidth
                  disabled={!isChecked}
                  placeholder="Knowledge Base ID"
                  sx={{ marginLeft: 2, align: "right" }}
                />
              </Box>
            </Grid>
            <Grid item xs={6}>
              <TextField
                variant="outlined"
                size="small"
                fullWidth
                onChange={(e) => setBatchGenerationPromptId(e.target.value)}
                placeholder="Prompt Template ID"
                sx={{ marginLeft: 0, align: "left" }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="S3 Bucket Name"
                onChange={(e) => sets3bucket(e.target.value)}
              ></TextField>
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Data file"
                onChange={(e) => sets3bucketFile(e.target.value)}
              ></TextField>
            </Grid>
          </Grid>
          {/* </Box> */}

          <Box mt={2}>
            <input
              key={Date.now()} // Add key to force re-render
              accept=".csv"
              style={{ display: "none" }}
              id="raised-button-file"
              type="file"
              onChange={(e) => {
                uploadS3(e.target.files[0]);
                e.target.value = null; // Reset file input
              }}
            />
            <label htmlFor="raised-button-file">
              <div style={{ height: "10px" }} />
              <Button
                variant="contained"
                component="span"
                fullWidth
                color="secondary"
              >
                Upload File
              </Button>
              <Snackbar
                anchorOrigin={{ vertical: "top", horizontal: "right" }}
                open={snackBarOpen}
                message={snackbarMessage}
                autoHideDuration={1500}
                onClose={(e) => setsnackBarOpen(false)}
              ></Snackbar>
            </label>
          </Box>
          <Button
            component="span"
            variant="contained"
            color="primary"
            sx={{ marginTop: "20px" }}
            fullWidth
            onClick={(e) => {
              invokeLLM(
                region,
                selectedModel,
                modelMap,
                s3bucket,
                s3bucketFile,
                setdialogMessage,
                setshowDialog,
                setinvokeARN,
                isChecked,
                batchGenerationPromptId,
              );
            }}
          >
            Start Generation
          </Button>

          <Divider style={{ margin: "40px 0" }} />

          <Box sx={{ marginTop: "40px", marginBottom: "10px" }}>
            <Typography variant="h4" gutterbottoms>
              Evaluation
            </Typography>
          </Box>
          <Select
            fullWidth
            value={selectedEvalModel}
            size="medium"
            onChange={(e) => setSelectedEvalModel(e.target.value)}
            displayEmpty
          >
            <MenuItem value="" disabled>
              Select model
            </MenuItem>
            {availableModels.map((model) => (
              <MenuItem key={model} value={model}>
                {model}
              </MenuItem>
            ))}
          </Select>
          <Box mt={2}>
            <FormControl variant="filled" fullWidth>
              <InputLabel id="select-metrics-label">Metrics</InputLabel>

              <Select
                multiple
                fullWidth
                value={selectedMetrics}
                onChange={(e) => setSelectedMetrics(e.target.value)}
                renderValue={(selected) =>
                  selected.length > 0 ? selected.join(", ") : "Select metrics"
                }
              >
                {Object.entries(evaluationMetricsMap).map(([key, value]) => (
                  <MenuItem key={key} value={key}>
                    {key}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          <Box mt={2}>
            <InputLabel
              id="select-metrics-label"
              sx={{ marginBottom: "8px" }} // Adds space between the label and the select box
            >
              {/* Metrics */}
            </InputLabel>
          </Box>
          <TextField
            variant="outlined"
            size="small"
            fullWidth
            onChange={(e) => setEvaluationFileLocation(e.target.value)}
            placeholder="Evaluation File Location"
            sx={{ marginBottom: "10px" }}
          />
          <Button
            component="span"
            variant="contained"
            color="primary"
            fullWidth
            onClick={(e) => {
              runEvaluation(
                region,
                modelMap,
                selectedEvalModel,
                setdialogMessage,
                setshowDialog,
                s3bucket,
                invokeARN,
                selectedMetrics,
                evaluationFileLocation,
              );
            }}
          >
            Start Evaluation
          </Button>
          <div style={{ height: "100px" }} />
        </Container>
      </div>
    </ThemeProvider>
  );
}

export default App;
