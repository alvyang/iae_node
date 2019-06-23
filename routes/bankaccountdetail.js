var express = require("express");
var logger = require('../utils/logger');
var util= require('../utils/global_util.js');
var router = express.Router();

//新增联系人
router.post("/saveAccountsDetail",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",76,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var accountDetail = DB.get("AccountDetail");
  req.body.account_detail_group_id = req.session.user[0].group_id;
  req.body.account_detail_create_userid = req.session.user[0].id;
  req.body.account_detail_time = new Date(req.body.account_detail_time).format('yyyy-MM-dd');
  req.body.account_detail_create_time = new Date();
  accountDetail.insert(req.body,'account_detail_id',function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "新增流水出错" + err);
    }
    var message = req.session.user[0].realname+"新增积分流水账记录。id："+result;
    util.saveLogs(req.session.user[0].group_id,"-",JSON.stringify(req.body),message);
    res.json({"code":"000000",message:result});
  });
});
//编辑联系人
router.post("/editAccountsDetail",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",74,") > -1){
    var accountDetail = DB.get("AccountDetail");
  	req.body.account_detail_group_id = req.session.user[0].group_id;
    req.body.account_detail_time = new Date(req.body.account_detail_time).format('yyyy-MM-dd');
    delete req.body.account_detail_create_time;
    var front_accountDetail = req.body.front_accountDetail;
    accountDetail.update(req.body,'account_detail_id',function(err,result){
      if(err){
        logger.error(req.session.user[0].realname + "修改流水出错" + err);
      }
      var message = req.session.user[0].realname+"修改积分流水账记录。";
      util.saveLogs(req.session.user[0].group_id,front_accountDetail,JSON.stringify(req.body),message);
      res.json({"code":"000000",message:null});
    });
  }else{
    res.json({"code":"111112",message:"无权限"});
  }
});
//删除联系人
router.post("/deleteAccountDetail",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",75,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var accountDetail = DB.get("AccountDetail");
  req.body.account_detail_deleta_flag = 1;
  accountDetail.update(req.body,'account_detail_id',function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "删除流水出错" + err);
    }
    var message = req.session.user[0].realname+"删除积分流水账记录。id："+req.body.account_detail_id;
    util.saveLogs(req.session.user[0].group_id,"-",JSON.stringify(req.body),message);
    res.json({"code":"000000",message:null});
  });
});
//获取银行账号列表
router.post("/getAccountsDetails",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",73,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var accountDetail = DB.get("AccountDetail");
  var sql = "select b.*,ba.account_number from bank_account_detail b left join bank_account ba on b.account_id = ba.account_id where b.account_detail_deleta_flag = '0' and b.account_detail_group_id = '"+req.session.user[0].group_id+"' ";
  if(!util.isEmpty(req.body.data.account_id)){
    sql += " and b.account_id = '"+req.body.data.account_id+"'";
  }
  if(!util.isEmpty(req.body.data.account_type)&&req.body.data.account_type == "1"){
    sql += " and b.account_detail_money >= 0 ";
  }else if(!util.isEmpty(req.body.data.account_type)&&req.body.data.account_type == "2"){
    sql += " and b.account_detail_money < 0 ";
  }
  if(!util.isEmpty(req.body.data.textarea)){
    sql += " and b.account_detail_mark like '%"+req.body.data.textarea+"%'";
  }
  if(req.body.data.account_detail_time){
    var start = new Date(req.body.data.account_detail_time[0]).format("yyyy-MM-dd");
    var end = new Date(req.body.data.account_detail_time[1]).format("yyyy-MM-dd");
    sql += " and DATE_FORMAT(b.account_detail_time,'%Y-%m-%d') >= '"+start+"' and DATE_FORMAT(b.account_detail_time,'%Y-%m-%d') <= '"+end+"'";
  }
  accountDetail.countBySql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "查询银行流水，查询总数出错" + err);
    }
    req.body.page.totalCount = result;
    req.body.page.totalPage = Math.ceil(req.body.page.totalCount / req.body.page.limit);
    sql += " order by b.account_detail_time desc,b.account_detail_create_time desc limit " + req.body.page.start + "," + req.body.page.limit + "";
    accountDetail.executeSql(sql,function(err,result){
      if(err){
        logger.error(req.session.user[0].realname + "查询银行流水出错" + err);
      }
      req.body.page.data = result;
      res.json({"code":"000000",message:req.body.page});
    });
  });
});
module.exports = router;
