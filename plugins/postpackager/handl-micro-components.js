const path = require("path");

// 页面判断正则
const PAGE_TEST_REG_EXP = /^\/pages\/[\w\/\.-]+\.js$/;

// 获取所有 component 声明正则
const ALL_COMPONENT_REG_EXP = /@component\(['"](.*)['"]\)[;]?/g;

// 获取 component 声明正则
const COMPONENT_REG_EXP = /@component\(['"](.*)['"]\)/;



/**
 * 是否是数组
 * @param  {Mix} subject 待判断的数据
 */
function isArray(subject) {
    return Array.isArray(subject);
}

/**
 * 驼峰转连字符
 * @param  {String} str 原始字符串
 * @return {String}     转化后的字符串
 */
function camelize2line(str) {
    return str.replace(/[A-Z]/g, function(str){
        return `-${str.toLowerCase()}`;
    });
}
var SUB_PACK_TEST_REG_EXP
var projectSubPackages = fis.get("project.subPackages")
if(projectSubPackages!== undefined&&isArray(projectSubPackages)){
    eval("SUB_PACK_TEST_REG_EXP = /^\\/(" + projectSubPackages.join("|") + ")\\/pages\\/[\\w\\/\\.-]+\\.js$/"); 
}
const component_name_reg = /^@(.*)$/ 

// 公共组件配置对象
var componentsModules = {};
fis.on("plugin:componentjson:inited", function(data){
    if (data) {
        Object.keys(data).forEach(function(com){
            // 预先生成公共组件的配置关系
            componentsModules[`${camelize2line(com)}`] = data[com];
        });
    }
});

module.exports = function (ret, conf, settings, opt) {
    var pages = Object.keys(ret.src).filter(function(name){
        return PAGE_TEST_REG_EXP.test(name)||(SUB_PACK_TEST_REG_EXP&&SUB_PACK_TEST_REG_EXP.test(name));
    });
    var dirs = {};

    if (pages && pages.length) {
        let dist = opt.dest;
        dist = dist.replace(/[\.]+/, "");
        if (dist.charAt(0) !== "/") {
            dist = "/" + dist;
        }
        while(pages.length) {
            let page = pages.pop();
            let file = ret.src[page];
            if (!dirs[file.subdirname]) {
                dirs[file.subdirname] = file.dirname.replace(
                    file.subdirname
                    ,`${dist}${file.release.replace("/"+file.basename, "")}`
                );
            }

            let content = file.getContent();
            let components = content.match(ALL_COMPONENT_REG_EXP);
            
            if (components && components.length) {
                let pageJsonPath = `${dirs[file.subdirname]}/${file.filename}.json`;
                let hasJson = fis.util.isFile(pageJsonPath);

                let pageJson;
                if (hasJson) {
                    pageJson = fis.util.readJSON(pageJsonPath);
                } else {
                    pageJson = {};
                }

                // 每次都重新生成
                pageJson.usingComponents = {};
                while(components.length) {
                    let comStr = components.pop();
                    let com = comStr.match(COMPONENT_REG_EXP);
                    com = com && com[1] || null;
                    if (com) {
                        let comPath;
                        let comName = camelize2line(com);
                        // 公共组件版本
                        let componentModuleVersion = componentsModules[comName];

                        if (componentModuleVersion) {
                            // 生成公共组件的声明路径
                            comPath = `/component_modules/${componentModuleVersion}/${com}/${com}`;
                        } else {
                            comPath = `/components/${com}/${com}`;
                            if(component_name_reg.test(com)){
                                com = com.replace("@", "");
                                comName = camelize2line(com);
                                var arr= file.subpath.split('/')
                                var urlFile=''
                                for(var i =0;i<arr.length-3;i++){
                                    urlFile+="../"
                                }
                                comPath = `${urlFile}components/${com}/${com}`;
                            }
                        }
                        pageJson.usingComponents[comName] = comPath;
                    }
                    content = content.replace(comStr, "");
                }
                file.setContent(content);

                fis.util.write(pageJsonPath, JSON.stringify(pageJson, 4, 4));
            }
        }
    }
}
