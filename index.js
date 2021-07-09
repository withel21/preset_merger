const term = require("terminal-kit").terminal;
const presetMan = require("./preset_manipulator");
const path = require("path");

let presetRootPath;
let presetInfos;
let sourcePresets;
let sourceSelectedCams;
let targetPresetName;

function PresetNameLoad() {
  try {
    term.clear();
    term.green("Enter ").inverse("PRESET ROOT FOLDER NAME").green(" : ");
    term.inputField((err, rootDir) => {
      if( err) {
        term.red.bold("\n" + err);
        term.black.bgYellow("\nRetry to press Enter key").inputField((err, enter) => {
          PresetNameLoad();
        })
        return;
      }
      presetRootPath = path.join(__dirname, rootDir);
      presetMan.readPresetDirs( presetRootPath, (err, presetNames) => {
        if(err) { 
          term.red.bold("\n" + err);
          term.black.bgYellow("\nRetry to press Enter key").inputField((err, enter) => {
            PresetNameLoad();
          })
          return;
        }
        GetPresetInfos(presetNames);
      });
    });
  } catch(err) {
    console.log("fail to get preset names!" + err);
    return [];
  }
}

function ShowPresetList() {
  term.green("\n--- Preset List ---\n")
  for(const pname in presetInfos) {
    term.red("preset name : [" + pname + "]\n");
  }
}

function GetPresetInfos(presets) {
  const presetDirs = presets.map(pname => path.join(presetRootPath, pname));
  presetMan.readPresetInfos(presetDirs, (err, infos) => {
    presetInfos = infos;
    //console.log(presetInfos);
    ShowMakeMenu();
  });
}

function ShowMakeMenu() {
  ShowPresetList();
  term.green("\n\nDo you want to make new preset from above presets?(Y/n) :");
  term.yesOrNo( { yes: [ 'y' , 'ENTER' ] , no: [ 'n' ] }, (err, answer) => {
    if(answer) {
      EnterNewPresetName();  
    } else {
      term.cyan("\n")
      process.exit();
    }
  });
}

function EnterNewPresetName() {
  //term.clear();
  term.green("\n\nPlease Enter ").inverse("NEW PRESET NAME").green(" : ");
  term.inputField((err, presetName) => {
    if( presetInfos.hasOwnProperty(presetName)) {
      term.cyan("\n'" + presetName + "' has been already registered. Please choose another preset name.\n");
      EnterNewPresetName();
    } else if( presetName === "") {
      term.cyan("\n'" + presetName + "' is invalid preset name.\n");
      EnterNewPresetName();
    } else {
      term.red("\nnew preset name is '" + presetName + "'\n");
      sourcePresets = [];
      targetPresetName = presetName;
      ChooseSourcePresets(presetName);
    }
  });
}

function ChooseSourcePresets(presetName) {
  term.clear();
  ShowPresetList();
  term.bgGreen.black("\nMAKE '" + presetName + "' preset\n");
  term.green("\nChoose source presets: \n");
  term.green("    arrow key: Navigate, ENTER: select/deselect, other keys: setting complete \n");
  
  const presets = [];
  
  for(const pname in presetInfos) {
    if(sourcePresets.includes(pname)) {
      presets.push("[V] " + pname);
    } else {
      presets.push("[ ] " + pname);
    }
  }
  
  term.gridMenu(presets, { exitOnUnexpectedKey: true}, (error, res) => {
    if(res.unexpectedKey) {
      const presetGen = GeneratePresetName();
      const preset = presetGen.next().value;

      if(preset !== undefined) {
        sourceSelectedCams = {};
        
        term.saveCursor(preset+"-cam-select");
        
        sourceSelectedCams[preset] = [];
        GetCamerasFromSourcePresets(preset, presetGen);
      }
      return;
    }

    const selectedPresetName = res.selectedText.substr(4);
    
    if(sourcePresets.includes(selectedPresetName)) {
      sourcePresets = sourcePresets.filter(preset => preset !== selectedPresetName);
    } else {
      sourcePresets.push(selectedPresetName);
    }

    ChooseSourcePresets(presetName);
  });
}

function ConstructCamList(preset) {
  const camLists = [];

  for(dsc of presetInfos[preset].dscs) {
    let selectStatus = " ";
    for(otherPreset of sourcePresets) {
      if(otherPreset !== preset) {
        if( sourceSelectedCams.hasOwnProperty(otherPreset) && sourceSelectedCams[otherPreset].includes(dsc)) {
          selectStatus = "X";
        }
      } else {
        if( sourceSelectedCams[preset].includes(dsc)) {
          selectStatus = "V";
        }
      }
    }
    camLists.push( "[" + selectStatus + "] " + dsc);
  }
  return camLists;
}

function* GeneratePresetName() {
  for(preset of sourcePresets) {
    yield preset;
  }
}

function GetCamerasFromSourcePresets(preset, presetGen) {
  term.restoreCursor(preset+"-cam-select");
    
  term.bgGreen("\nChoose Cameras on preset - [" + preset + "]\n");
  term.green("    arrow key: Navigate, ENTER: select/deselect, other keys: setting complete \n");
  term.gridMenu(ConstructCamList(preset), { exitOnUnexpectedKey: true}, (error, res) => {
    if(res.unexpectedKey) {
      const nextPreset = presetGen.next().value;
      if( nextPreset === undefined) {
        MakePreset();
      } else {
        term.saveCursor(nextPreset+"-cam-select");
        sourceSelectedCams[nextPreset] = [];
        GetCamerasFromSourcePresets(nextPreset, presetGen);
      }
      return;
    }
    
    if( res.selectedText[1] !== "X") {
      const selectedCam = res.selectedText.substr(4);
      
      if(sourceSelectedCams[preset].includes(selectedCam)) {
        sourceSelectedCams[preset] = sourceSelectedCams[preset].filter(cam => cam !== selectedCam);
      } else {
        sourceSelectedCams[preset].push(selectedCam);
      }
    }

    GetCamerasFromSourcePresets(preset, presetGen);
  });
}

function MakePreset() {
  term.saveCursor(targetPresetName+"-make-cursor");
  presetMan.GeneratePreset(targetPresetName, sourceSelectedCams, presetInfos, presetRootPath, (error, msg, done) => {
    if( error) {
      console.log(error);
      return;
    }
    term.restoreCursor(targetPresetName+"-make-cursor");
    if( done) {
      term.bgGreen("DONE : " + msg);
      targetPresetName = "";
      ShowMakeMenu();
    } else {
      term.green(msg);
    }
  });
}


term.on('key', (name, matched, data)=> {
  if( name === "CTRL_C") {
    term.nextLine(1);
    process.exit();
  }
});

PresetNameLoad();
