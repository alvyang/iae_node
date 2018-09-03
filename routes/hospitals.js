var express = require("express");
var logger = require('../utils/logger');
var router = express.Router();

//新增医院
router.post("/saveHospitals",function(req,res){
  if(req.session.user[0].authority_code.indexOf("28") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var hospitals = DB.get("Hospitals");
  req.body.group_id = req.session.user[0].group_id;
  hospitals.insertIncrement(req.body,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "查询医院出错" + err);
    }
    res.json({"code":"000000",message:result});
  });
});
//编辑医院
router.post("/editHospitals",function(req,res){
  if(req.session.user[0].authority_code.indexOf("29") > -1){
    var hospitals = DB.get("Hospitals");
  	req.body.group_id = req.session.user[0].group_id;
    hospitals.update(req.body,'hospital_id',function(err,result){
      if(err){
        logger.error(req.session.user[0].realname + "修改医院出错" + err);
      }
      res.json({"code":"000000",message:null});
    });
  }else{
    res.json({"code":"111112",message:"无权限"});
  }
});
//删除医院
router.post("/deleteHospitals",function(req,res){
  if(req.session.user[0].authority_code.indexOf("30") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var hospitals = DB.get("Hospitals");
  req.body.delete_flag = 1;
  hospitals.update(req.body,'hospital_id',function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "删除医院出错" + err);
    }
    res.json({"code":"000000",message:null});
  });
});
//获取医院列表
router.post("/getHospitals",function(req,res){
  if(req.session.user[0].authority_code.indexOf("31") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var hospitals = DB.get("Hospitals");
  req.body.data.group_id = req.session.user[0].group_id;
  req.body.data.delete_flag = 0;
  hospitals.queryPage(req.body.page,req.body.data,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "查询医院列表，分页查询出错" + err);
    }
    res.json({"code":"000000",message:result});
  });
});
//获取全部医院列表
router.post("/getAllHospitals",function(req,res){
  var hospitals = DB.get("Hospitals");
  hospitals.where({
    group_id:req.session.user[0].group_id,
    delete_flag:0
  },function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "查询全部医院出错" + err);
    }
    res.json({"code":"000000",message:result});
  });
});
module.exports = router;
