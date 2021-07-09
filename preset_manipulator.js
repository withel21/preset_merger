const path = require("path");
const fs = require("fs");

function readPresetDirs(rootDir, cb) {
  const presetNames = [];
  try {
    fs.readdir(rootDir, (err, dir) => {
      if(err) {
        cb(err, null);
        return;
      }
      for (const dirent of dir) {
        presetNames.push( dirent);
      }
      cb(null, presetNames);
    });    
  } catch(err) {
    console.log("\nfail to get presets " + err +"\n");
    cb(err, presetNames);
  }
}

function readPresetInfos(presetDirs, cb) {
  const presetInfo = {};

  try {
    for(const pdir of presetDirs) {
      const presetName = pdir.substr( pdir.lastIndexOf(path.sep)+1);
      presetInfo[presetName] = {
        dscs: [],
        pts: {},
        adj: {}
      };
      dirs = fs.readdirSync(pdir);
      {
        for(const dirent of dirs) {
          const rePngFile = /^(\d{6})\_ref\.png$/i;
          const filePath = path.join(pdir, dirent);
                    
          const matchPng = dirent.match(rePngFile);
          if( matchPng && presetInfo[presetName].dscs.find(camId => camId === matchPng[1]) == null) {
            presetInfo[presetName].dscs.push(matchPng[1]);
          } else if(dirent === "UserPointData.pts") {
            presetInfo[presetName].pts = JSON.parse(fs.readFileSync(filePath));
          } else if(dirent === "UserPointData.adj") {
            presetInfo[presetName].adj = JSON.parse(fs.readFileSync(filePath));
          }
        }
        presetInfo[presetName].dscs.sort();
        // Verification
        // for(point of presetInfo[presetName].pts.points) {
        //   if( presetInfo[presetName].dscs.find(camId => camId === point.dsc_id.substr(0, 6)) == null) {
        //     console.log("PTS: dsc not found : " + point.dsc_id, point.dsc_id.substr(0, 6));
        //   }
        // }

        // for(adj of presetInfo[presetName].adj.adjust_list) {
        //   if( presetInfo[presetName].dscs.find(camId => camId === adj.dsc_id.substr(0, 6)) == null) {
        //     console.log("ADJ: dsc not found : " + adj.dsc_id, adj.dsc_id.substr(0, 6));
        //   }
        // }

      }
    }
    cb(null, presetInfo);
  } catch( err) {
    console.log("\nfail to get preset infos " + err + "\n");
    cb(err, null);
  }
}



function GeneratePreset(newPresetName, sourceCams, presetInfos, presetRootPath, cb) {
  try {
    const tgtPresetPath = path.join(presetRootPath, newPresetName);
    const presetNames = Object.keys(sourceCams).map(pname => pname);
    presetInfos[newPresetName] = {
      pts: {
        setting: {},
        worlds: [],
        points: []
      },
      adj: {
        adjust_list: [],
      }
    };

    if( fs.mkdirSync(tgtPresetPath) === tgtPresetPath) {
      cb(null, "preset path created - '" + tgtPresetPath + "'", false);
    }
    
    for(const pname of presetNames) {
      const srcPresetPath = path.join(presetRootPath, pname)
      sourceCams[pname].sort();
      const dirents = fs.readdirSync( srcPresetPath);
      if( dirents !== undefined) {
        for(const dirent of dirents) {
          if(dirent !== "UserPointData.pts" && dirent !== "UserPointData.adj") {
            const camId = dirent.substr(0, 6);

            if( sourceCams[pname].includes(camId)) {
              cb(null, "copying '" + dirent + "' from '" + srcPresetPath + "' to '" + tgtPresetPath + "'...", false);

              fs.copyFile(path.join(srcPresetPath, dirent), path.join(tgtPresetPath, dirent), () => {
                cb(null, "copied '" + dirent + "' from '" + srcPresetPath + "' to '" + tgtPresetPath + "'!", false);
              });
            }
          }
        }
      } else {
        cb("fail to readdir - " + presetPath, "", false);
      }

      cb(null, "Extracting pts/adj info for '" + pname + "'...", false);
     
      if( !presetInfos[newPresetName].pts.setting.hasOwnProperty("calmode")) {
        presetInfos[newPresetName].pts.setting = {...presetInfos[pname].pts.setting};
        presetInfos[newPresetName].pts.worlds = [...presetInfos[pname].pts.worlds];
      }
      for(const camId of sourceCams[pname]) {
        const points = presetInfos[pname].pts.points.filter(pts => pts.dsc_id.startsWith(camId));
        const adjust = presetInfos[pname].adj.adjust_list.filter(adj => adj.dsc_id.startsWith(camId));

        presetInfos[newPresetName].pts.points.push(...points);
        presetInfos[newPresetName].adj.adjust_list.push(...adjust);
      }
    }

    cb(null, "Writing pts info for preset '" + newPresetName + "'...", false);
    fs.writeFileSync( path.join(tgtPresetPath, "UserPointData.pts"), JSON.stringify(presetInfos[newPresetName].pts, null, 2));

    cb(null, "Writing adj info for preset '" + newPresetName + "'...", false);
    fs.writeFileSync( path.join(tgtPresetPath, "UserPointData.adj"), JSON.stringify(presetInfos[newPresetName].adj, null, 2));

    cb(null, "complete '" + newPresetName + "'", true);

  } catch(error) {
    cb(error, "", false);
  }
}

module.exports = {
  readPresetDirs,
  readPresetInfos,
  GeneratePreset
};