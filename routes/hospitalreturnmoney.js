var express = require("express");
var logger = require('../utils/logger');
var router = express.Router();

//新增医院回款
router.post("/saveReturnMoney",function(req,res){
  if(req.session.user[0].authority_code.indexOf("87") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var hospitalReturnMoney = DB.get("HospitalReturnMoney");
  req.body.return_money_group_id = req.session.user[0].group_id;
  req.body.return_money_create_userid = req.session.user[0].id;
  req.body.return_money_time = new Date(req.body.return_money_time).format("yyyy-MM-dd");
  req.body.return_money_create_time = new Date();
  hospitalReturnMoney.insert(req.body,'return_money_id',function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "新增医院回款出错" + err);
    }
    res.json({"code":"000000",message:result});
  });
});
//编辑医院回款
router.post("/editReturnMoney",function(req,res){
  if(req.session.user[0].authority_code.indexOf("85") > -1){
    var hospitalReturnMoney = DB.get("HospitalReturnMoney");
    delete req.body.business_name;
    delete req.body.hospital_name;
    delete req.body.return_money_create_time;
  	req.body.return_money_group_id = req.session.user[0].group_id;
    req.body.return_money_time = new Date(req.body.return_money_time).format("yyyy-MM-dd");
    hospitalReturnMoney.update(req.body,'return_money_id',function(err,result){
      if(err){
        logger.error(req.session.user[0].realname + "修改医院回款出错" + err);
      }
      res.json({"code":"000000",message:null});
    });
  }else{
    res.json({"code":"111112",message:"无权限"});
  }
});
//删除医院回款
router.post("/deleteReturnMoney",function(req,res){
  if(req.session.user[0].authority_code.indexOf("86") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var hospitalReturnMoney = DB.get("HospitalReturnMoney");
  req.body.return_money_delete_flag = 1;
  hospitalReturnMoney.update(req.body,'return_money_id',function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "删除医院回款出错" + err);
    }
    res.json({"code":"000000",message:null});
  });
});
//获取医院回款列表
router.post("/getReturnMoney",function(req,res){
  if(req.session.user[0].authority_code.indexOf("84") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var hospitalReturnMoney = DB.get("HospitalReturnMoney");

  var sql = "select hrmb.*,b.business_name from hospital_return_money hrmb left join business b on hrmb.return_money_business = b.business_id "+
            "where hrmb.return_money_group_id = '"+req.session.user[0].group_id+"' and hrmb.return_money_delete_flag = '0'";

      sql ="select hrm.*,h.hospital_name from ("+sql+") hrm left join hospitals h on hrm.return_money_hospital = h.hospital_id where 1=1";
  //数据权限
  if(req.session.user[0].data_authority == "2"){
    sql += "and hrm.return_money_create_userid = '"+req.session.user[0].id+"'";
  }
  if(req.body.data.hospitalsId){
    sql += " and hrm.return_money_business like '%"+req.body.data.hospitalsId+"%'";
  }
  if(req.body.data.business){
    sql += " and hrm.return_money_business like '%"+req.body.data.business+"%'";
  }
  var start = new Date(req.body.data.startTime).format("yyyy-MM-dd");
  if(req.body.data.startTime){
    sql += " and DATE_FORMAT(hrm.return_money_time,'%Y-%m-%d') >= '"+start+"'";
  }
  var end = new Date(req.body.data.endTime).format("yyyy-MM-dd");
  if(req.body.data.endTime){
    sql += " and DATE_FORMAT(hrm.return_money_time,'%Y-%m-%d') <= '"+end+"'";
  }
  hospitalReturnMoney.countBySql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "查询医院回款，查询总数出错" + err);
    }
    req.body.page.totalCount = result;
    req.body.page.totalPage = Math.ceil(req.body.page.totalCount / req.body.page.limit);
    sql += " order by hrm.return_money_time desc,hrm.return_money_create_time limit " + req.body.page.start + "," + req.body.page.limit + "";
    hospitalReturnMoney.executeSql(sql,function(err,result){
      if(err){
        logger.error(req.session.user[0].realname + "查询医院回款出错" + err);
      }
      req.body.page.data = result;
      res.json({"code":"000000",message:req.body.page});
    });
  });
});
module.exports = router;
