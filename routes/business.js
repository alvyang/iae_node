var express = require("express");
var logger = require('../utils/logger');
var router = express.Router();

//新增联系人
router.post("/saveBusiness",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",92,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var business = DB.get("Business");
  req.body.business_group_id = req.session.user[0].group_id;
  req.body.business_create_userid = req.session.user[0].id;
  req.body.business_create_time = new Date();
  business.insert(req.body,'business_id',function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "新增商业出错" + err);
    }
    res.json({"code":"000000",message:result});
  });
});
//编辑联系人
router.post("/editBusiness",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",91,") > -1){
    var business = DB.get("Business");
  	req.body.business_group_id = req.session.user[0].group_id;
    delete req.body.business_create_time;
    business.update(req.body,'business_id',function(err,result){
      if(err){
        logger.error(req.session.user[0].realname + "修改商业出错" + err);
      }
      res.json({"code":"000000",message:null});
    });
  }else{
    res.json({"code":"111112",message:"无权限"});
  }
});
//删除联系人
router.post("/deleteBusiness",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",90,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var business = DB.get("Business");
  req.body.business_delete_flag = 1;
  business.update(req.body,'business_id',function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "删除商业出错" + err);
    }
    res.json({"code":"000000",message:null});
  });
});
//获取联系人列表
router.post("/getBusiness",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",89,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var business = DB.get("Business");
  var sql = "select * from business b where b.business_delete_flag = '0' and b.business_group_id = '"+req.session.user[0].group_id+"'";
  if(req.body.data.business_name){
    sql += " and b.business_name like '%"+req.body.data.business_name+"%'";
  }
  business.countBySql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "查询商业，查询总数出错" + err);
    }
    req.body.page.totalCount = result;
    req.body.page.totalPage = Math.ceil(req.body.page.totalCount / req.body.page.limit);
    sql += " order by b.business_create_time desc limit " + req.body.page.start + "," + req.body.page.limit + "";
    business.executeSql(sql,function(err,result){
      if(err){
        logger.error(req.session.user[0].realname + "查询商业出错" + err);
      }
      req.body.page.data = result;
      res.json({"code":"000000",message:req.body.page});
    });
  });
});
//获取联系人列表
router.post("/getAllBusiness",function(req,res){
  var business = DB.get("Business");
  req.body.business_group_id = req.session.user[0].group_id;
  req.body.business_delete_flag = 0;
  business.where(req.body,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "查询商业，查询所有商业出错" + err);
    }
    res.json({"code":"000000",message:result});
  });
});
module.exports = router;
