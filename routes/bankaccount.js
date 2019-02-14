var express = require("express");
var logger = require('../utils/logger');
var router = express.Router();

//新增联系人
router.post("/saveAccounts",function(req,res){
  if(req.session.user[0].authority_code.indexOf("68,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var account = DB.get("Account");
  delete req.body.money;
  req.body.account_group_id = req.session.user[0].group_id;
  req.body.bank_create_userid = req.session.user[0].id;
  req.body.bank_create_time = new Date();
  account.insert(req.body,'account_id',function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "新增银行账号出错" + err);
    }
    res.json({"code":"000000",message:result});
  });
});
//编辑联系人
router.post("/editAccounts",function(req,res){
  if(req.session.user[0].authority_code.indexOf("70,") > -1){
    var account = DB.get("Account");
    delete req.body.money;
    delete req.body.bank_create_time;
  	req.body.account_group_id = req.session.user[0].group_id;
    account.update(req.body,'account_id',function(err,result){
      if(err){
        logger.error(req.session.user[0].realname + "修改银行账号出错" + err);
      }
      res.json({"code":"000000",message:null});
    });
  }else{
    res.json({"code":"111112",message:"无权限"});
  }
});
//删除联系人
router.post("/deleteAccount",function(req,res){
  if(req.session.user[0].authority_code.indexOf("69,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var account = DB.get("Account");
  req.body.account_delete_flag = 1;
  account.update(req.body,'account_id',function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "删除银行账号出错" + err);
    }
    res.json({"code":"000000",message:null});
  });
});
//获取银行账号列表
router.post("/getAccounts",function(req,res){
  if(req.session.user[0].authority_code.indexOf("67,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var account = DB.get("Account");
  var sql = "select b.*,round(sum(bad.account_detail_money),2) money from bank_account b left join bank_account_detail bad on bad.account_id = b.account_id "+
            "where b.account_delete_flag = '0' and b.account_group_id = '"+req.session.user[0].group_id+"' "+
            "and (bad.account_detail_deleta_flag = '0' || bad.account_detail_deleta_flag is null) and (bad.account_detail_group_id = '"+req.session.user[0].group_id+"' || bad.account_detail_group_id is null)";
  if(req.body.data.account_number){
    sql += " and b.account_number like '%"+req.body.data.account_number+"%'";
  }
  sql += " group by b.account_id"
  account.countBySql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "查询银行账号，查询总数出错" + err);
    }
    req.body.page.totalCount = result;
    req.body.page.totalPage = Math.ceil(req.body.page.totalCount / req.body.page.limit);
    sql += " order by b.bank_create_time desc limit " + req.body.page.start + "," + req.body.page.limit + "";
    account.executeSql(sql,function(err,result){
      if(err){
        logger.error(req.session.user[0].realname + "查询银行账号出错" + err);
      }
      req.body.page.data = result;
      res.json({"code":"000000",message:req.body.page});
    });
  });
});
//获取全部银行账号列表
router.post("/getAllAccounts",function(req,res){
  var account = DB.get("Account");
  var sql = "select * from bank_account b where b.account_delete_flag = '0' and b.account_group_id = '"+req.session.user[0].group_id+"'";
  account.executeSql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "查询全部银行账号出错" + err);
    }
    res.json({"code":"000000",message:result});
  });
});

module.exports = router;
