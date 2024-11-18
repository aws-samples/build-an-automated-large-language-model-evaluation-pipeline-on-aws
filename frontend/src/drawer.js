import React, { useState } from "react";

import IconButton from "@mui/material/IconButton";
import MenuIcon from "@mui/icons-material/Menu";
import Drawer from "@mui/material/Drawer";
import Backdrop from "@mui/material/Backdrop";
import { TextField, MenuItem, InputLabel, FormControl } from "@mui/material";
import Box from "@mui/material/Box";
import Select from "@mui/material/Select";

import { getModels, getPrompts } from "./functions";

export function CustomDrawer(
  region,
  setRegion,
  regions,
  setModelMap,
  setPrompts,
  setAvailableModels,
  setdialogMessage,
  setshowDialog,
) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [textFieldValue, setTextFieldValue] = useState("");
  const [selectValue, setSelectValue] = useState("");

  const handleToggleDrawer = (open) => {
    setSelectValue(region);
    setDrawerOpen(open);
  };

  const handleTextFieldChange = (event) => {
    setTextFieldValue(event.target.value);
  };

  const handleSelectChange = (event) => {
    setSelectValue(event.target.value);
  };

  const handleBackdropClick = () => {
    setDrawerOpen(false);
    setRegion(selectValue);
    if (selectValue.length !== 0) {
      getModels(
        selectValue,
        setModelMap,
        setAvailableModels,
        setdialogMessage,
        setshowDialog,
      );

      getPrompts(selectValue, setPrompts, setdialogMessage, setshowDialog);
    }
  };

  return (
    <>
      <IconButton
        color="inherit"
        aria-label="open drawer"
        onClick={() => handleToggleDrawer(true)}
        edge="start"
      >
        <MenuIcon />
      </IconButton>
      <Drawer
        anchor="left"
        open={drawerOpen}
        onClose={handleBackdropClick}
        BackdropProps={{
          invisible: true, // Make the backdrop invisible but still functional
        }}
      >
        <div
          role="presentation"
          style={{ width: 250, padding: 20 }}
          onChange={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()} // Prevent event propagation for click
        >
          <Box p={1} width={220}>
            <FormControl
              fullWidth
              style={{ marginBottom: "20px" }}
              variant="standard"
            >
              <InputLabel>Select Region</InputLabel>
              <Select
                labelId="select1-label"
                value={selectValue}
                onChange={handleSelectChange}
              >
                <MenuItem value="" disabled>
                  Select region
                </MenuItem>
                {regions.map((model) => (
                  <MenuItem key={model} value={model} id="select">
                    {model}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl
              fullWidth
              style={{ marginBottom: "20px" }}
              variant="standard"
            ></FormControl>
          </Box>
        </div>
      </Drawer>
      {drawerOpen && (
        <Backdrop
          open={drawerOpen}
          onClick={handleBackdropClick}
          sx={{ zIndex: 1 }}
        />
      )}
    </>
  );
}
