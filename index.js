'use strict';
const _postcss = require('postcss');
const _autoprefixer = require('autoprefixer');
const _async = require('async');

var _DefaultSetting = {
  "regexp": "(\.css)$",
  "options": {}
}

//判断该文件是否需要处理
const isNeedCompile = (pathname)=>{
  let reg = new RegExp(_DefaultSetting.regexp)
  return reg.test(pathname.toLowerCase())
}

function getAutoPrefixerHtml(content, cleaner){
  return content.replace(/<style[^>]*>([\s\S]+?)<\/style>/gi,(line, match)=>{
    //只编译type存在并且type类型为css的 和 纯style的
    let typeMatch = line.match(/<style[^\>]+type\=['"]([^>'"]+)['"]>/)
    if((typeMatch && typeMatch[1] == "text/css") ||line.match(/<style>/)){
      let compileCss = cleaner.process(match).css
      return line.replace(match, compileCss)
    }
    return line
  })
}


exports.registerPlugin = function(cli, options){
  cli.utils.extend(_DefaultSetting, options)
  let setting = _DefaultSetting.options || {};
  let cleaner = _postcss([_autoprefixer(setting)])
  //处理css
  cli.registerHook('route:willResponse',async (req, data, responseContent)=>{
    if(!isNeedCompile(data.realPath)){
      return responseContent
    }
    if(!responseContent){
      return responseContent
    }
    return  cleaner.process(responseContent).then((result)=>{
              result.warnings().forEach((warn)=>{
                console.warn(warn.toString())
              });
              return result.css
            })
  }, 1)

  cli.registerHook('build:doCompile', (buildConfig, data, content, cb)=>{
    let outputFilePath = data.outputFilePath;
    if(!/(\.css)$/.test(outputFilePath) || !content){
      return cb(null, content)
    }
    cleaner.process(content)
      .then((result)=>{
        result.warnings().forEach((warn)=>{
          cli.log.warn(warn.toString())
        });
        cb(null, result.css)
      })
      .catch((error)=>{cb(error);})
  }, 50)

  //是否开启html，css autoprefixer, 不开启则不注册hook了
  if(!_DefaultSetting.html){
    return;
  }
  //处理html
  cli.registerHook(['precompile:replace'], async (buildConfig, content)=>{
    return getAutoPrefixerHtml(content, cleaner)
  }, 1)
  //处理html
  cli.registerHook(['route:willResponse'], async (req, data, responseContent)=>{
    let pathname = data.realPath;
    if(!/(\.html)$/.test(pathname)){
      return responseContent
    }
    //没有经过 hbs 编译, 纯html,不处理
    if(data.status != 200 || !responseContent){
      return responseContent
    }
    return getAutoPrefixerHtml(responseContent, cleaner)
  }, 1)

  cli.registerHook('build:didCompile', async (buildConfig, data, content)=>{
    if(!/(\.html)$/.test(data.outputFilePath) || !content){
      return content
    }
    return getAutoPrefixerHtml(content, cleaner)
  }, 1)

}