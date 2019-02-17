var express = require("express");
var logger = require('../utils/logger');
var router = express.Router();
//验证产品编码是否存在
router.post("/exitsHospitlsName",function(req,res){
  var hospitals = DB.get("Hospitals");
  var params={
    hospital_name:req.body.hospital.hospital_name,
    group_id:req.session.user[0].group_id,
    delete_flag:'0'
  }
  hospitals.where(params,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "验证销售医院是否存在出错" + err);
    }
    res.json({"code":"000000",message:result});
  });
});
//新增医院
router.post("/saveHospitals",function(req,res){
  if(req.session.user[0].authority_code.indexOf("28,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var hospitals = DB.get("Hospitals");
  req.body.group_id = req.session.user[0].group_id;
  req.body.hospital_create_userid = req.session.user[0].id;
  req.body.hospital_create_time = new Date();
  hospitals.insert(req.body,'hospital_id',function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "查询医院出错" + err);
    }
    res.json({"code":"000000",message:result});
  });
});
//编辑医院
router.post("/editHospitals",function(req,res){
  if(req.session.user[0].authority_code.indexOf("29,") > -1){
    var hospitals = DB.get("Hospitals");
  	req.body.group_id = req.session.user[0].group_id;
    delete req.body.hospital_create_time;
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
  if(req.session.user[0].authority_code.indexOf("30,") < 0){
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
  if(req.session.user[0].authority_code.indexOf("31,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var hospitals = DB.get("Hospitals");
  var sql = "select * from hospitals h where h.delete_flag = '0' and h.group_id = '"+req.session.user[0].group_id+"'";
  if(req.body.data.hospital_name){
    sql += " and h.hospital_name like '%"+req.body.data.hospital_name+"%'";
  }
  if(req.body.data.hospital_type){
    sql += " and h.hospital_type like '%"+req.body.data.hospital_type+"%'";
  }
  hospitals.countBySql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "查询医院列表，查询总数出错" + err);
    }
    req.body.page.totalCount = result;
    req.body.page.totalPage = Math.ceil(req.body.page.totalCount / req.body.page.limit);
    sql += " order by h.hospital_create_time desc limit " + req.body.page.start + "," + req.body.page.limit + "";
    hospitals.executeSql(sql,function(err,result){
      if(err){
        logger.error(req.session.user[0].realname + "查询医院列表出错" + err);
      }
      req.body.page.data = result;
      res.json({"code":"000000",message:req.body.page});
    });
  });
});
//获取全部医院列表
router.post("/getAllHospitals",function(req,res){
  var hospitals = DB.get("Hospitals");
  hospitals.where({
    group_id:req.session.user[0].group_id,
    delete_flag:0,
    hospital_type:req.body.hospital_type
  },function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "查询全部医院出错" + err);
    }
    res.json({"code":"000000",message:result});
  });
});
module.exports = router;
