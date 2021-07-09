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
    term.error("fail to get preset names!" + err);
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
  
  const presets = [];
  
  for(const pname in presetInfos) {
    if(sourcePresets.includes(pname)) {
      presets.push({name: pname, status: "V"});
    } else {
      presets.push({name: pname, status: " "});
    }
  }
  
  gridMenu(presets, (error, res) => {
    sourcePresets = res.filter(menu => menu.status === "V").map(menu => menu.name);

    const presetGen = GeneratePresetName();
    const preset = presetGen.next().value;

    if(preset !== undefined) {
      sourceSelectedCams = {};
        
      term.saveCursor();
        
      sourceSelectedCams[preset] = [];
      GetCamerasFromSourcePresets(preset, presetGen);
    }
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

function ConstructCamListA(preset) {
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
    camLists.push( {name: dsc, status: selectStatus} );
  }
  return camLists;
}

function* GeneratePresetName() {
  for(preset of sourcePresets) {
    yield preset;
  }
}

function GetCamerasFromSourcePresets(preset, presetGen) {
  term.bgGreen("\nChoose Cameras on preset - [" + preset + "]\n");
  gridMenu(ConstructCamListA(preset), (error, res) => {
    if(error) {
      term.error(error);
      return;
    }

    sourceSelectedCams[preset] = res.filter(menu => menu.status === "V").map(menu => menu.name);
    
    const nextPreset = presetGen.next().value;
    if( nextPreset === undefined) {
      term("\n\n");
      MakePreset();
    } else {
      sourceSelectedCams[nextPreset] = [];
      GetCamerasFromSourcePresets(nextPreset, presetGen);
    }
  });
}

function MakePreset() {
  presetMan.GeneratePreset(targetPresetName, sourceSelectedCams, presetInfos, presetRootPath, (error, msg, done) => {
    if( error) {
      term.error(error);
      return;
    }
    if( done) {
      term.bgGreen("DONE : " + msg + "\n").green("\n");
      targetPresetName = "";
      ShowMakeMenu();
    } else {
      term.green(msg + "\n");
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

// Helper Module
let gridMenuMode = false;
function gridMenu(menuItems, cb) {
  const maxLen = Math.max.apply(null, menuItems.map(menu => menu.name.length)) + 4;
  const tabLen = (maxLen + 4 > 10) ? maxLen + 4: 10;
  
  term.green("\tarrow key: Navigate, ENTER: select/deselect, ESC: setting complete\n");
  term.getCursorLocation((error, x, y) => {
    if(!error) {
      const startX = x;
      const startY = y;
      let endY = y;
      let curX = x;
      let curY = y;
      
      for(const menu of menuItems) {
        const menuItem = "[" + menu.status + "] " + menu.name;
        menu.x = curX;
        menu.y = curY;
        
        term.moveTo(curX, curY);

        if(menu.status === "V") {
          term.inverse(menuItem);
        } else if(menu.status === "X") {
          term.gray(menuItem);
        } else {
          term(menuItem);
        }

        curX += tabLen;
        if(curX + tabLen >= term.width) {
          curX = 1;
          curY += 1;
        }
      }
      endY = curY;

      term.moveTo(startX, startY);
      curX = startX;
      curY = startY;

      gridMenuMode = true;
      term.on('key', (name, matched, data) => {
        if( gridMenuMode && curX != -1 && curY != -1) {
          switch(name) {
            case "LEFT":
              if(curX >= tabLen) curX -= tabLen;
              break;
            case "RIGHT":
              if(curX + tabLen <= term.width - tabLen) curX += tabLen;
              break;
            case "UP":
              if(curY > startY) curY -= 1;
              break;
            case "DOWN":
              if(curY < endY) curY += 1;
              break;
            case "ENTER":
              const curMenu = menuItems.filter((menu) => menu.x === curX && menu.y === curY);
              if(curMenu && curMenu[0] && curMenu[0].status !== "X") {
                const menu = curMenu[0];
                menu.status = (menu.status === "V") ? " " : "V";
                const menuItem = "[" + menu.status + "] " + menu.name;
                if(menu.status === "V") {
                  term.inverse(menuItem);
                } else if(menu.status === "X") {
                  term.gray(menuItem);
                } else {
                  term(menuItem);
                }
              }
              break;
            case "ESCAPE":
              curX = 1;
              curY = endY + 1;
              term.moveTo(curX, curY);
              curX = -1;
              curY = -1;
              gridMenuMode = false;
              cb(null, menuItems);
              return;
          }
          term.moveTo(curX, curY);
        }
      });

    }
  });
}