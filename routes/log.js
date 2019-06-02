var express = require("express");
var nodeExcel = require('excel-export');
var logger = require('../utils/logger');
var fs = require('fs');
var util= require('../utils/global_util.js');
var uuid=require("node-uuid");
var parse = require('csv-parse');
var XLSX = require("xlsx");
var router = express.Router();

router.post("/getLogs",function(req,res){
  var noDate = new Date();
  var log = DB.get("Log");
  var sql = "select * from log l where l.log_group_id = '"+req.session.user[0].group_id+"' ";
  if(req.body.data.log_message){
    sql += "and l.log_remark like '%"+req.body.data.log_message+"%' ";
  }
  log.countBySql(sql,function(err,num){//查询调货总数
    if(err){
      logger.error(req.session.user[0].realname + "查询日志列表，查询日志总数出错" + err);
    }
    req.body.page.totalCount = num;
    req.body.page.totalPage = Math.ceil(req.body.page.totalCount / req.body.page.limit);
    sql += " order by l.log_create_time desc limit " + req.body.page.start + "," + req.body.page.limit + "";
    log.executeSql(sql,function(err,result){
      if(err){
        logger.error(req.session.user[0].realname + "查询日志列表出错" + err);
      }
      req.body.page.data = result;
      logger.error(req.session.user[0].realname + "allot-getLogs运行时长" + (noDate.getTime()-new Date().getTime()));
      res.json({"code":"000000",message:req.body.page});
    });
  });
});

module.exports = router;
