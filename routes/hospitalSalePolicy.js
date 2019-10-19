var express = require("express");
var logger = require('../utils/logger');
var util = require('../utils/global_util');
var router = express.Router();

//批量修改政策
router.post("/editBatchHospitalSalePolicy",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",181,") > -1){
    var hospitalSalePolicy = DB.get("HospitalSalePolicy");
    var sql = "insert into hospital_sale_policy(hospital_sale_policy_userid,hospital_sale_policy_group_id,hospital_sale_policy_create_time,"+
              "hospital_sale_policy_hospital_id,hospital_sale_policy,hospital_sale_contacts_id,policy_percent,hospital_sale_policy_remark) values ";
    var ids = req.body.hospitalIds;
    for(var i = 0 ; i < ids.length ;i++){
        sql+="('"+req.session.user[0].id+"','"+req.session.user[0].group_id+"','"+new Date().format("yyyy-MM-dd")+"','"+ids[i]+"','"+req.body.hospital_sale_policy+"','"+req.body.hospital_sale_contacts_id+"','"+req.body.policy_percent+"','"+req.body.hospital_sale_policy_remark+"'),";
    }
    sql = sql.substring(0,sql.length-1);
    sql +=" ON DUPLICATE KEY UPDATE hospital_sale_policy_userid=VALUES(hospital_sale_policy_userid),hospital_sale_policy_group_id=VALUES(hospital_sale_policy_group_id),"+
          "hospital_sale_policy_create_time=VALUES(hospital_sale_policy_create_time),hospital_sale_policy=VALUES(hospital_sale_policy),hospital_sale_contacts_id=VALUES(hospital_sale_contacts_id),policy_percent=VALUES(policy_percent),hospital_sale_policy_remark=VALUES(hospital_sale_policy_remark)";

    hospitalSalePolicy.executeSql(sql,function(err,result){
      if(err){
        logger.error(req.session.user[0].realname + "批量修改销往单位政策出错" + err);
      }
      var message = req.session.user[0].realname+"批量修改销往单位政策";
      util.saveLogs(req.session.user[0].group_id,"-","-",message);
      res.json({"code":"000000",message:""});
    });
  }else{
    res.json({"code":"111112",message:"无权限"});
  }
});
//编辑销往单位政策
router.post("/editHospitalSalePolicy",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",181,") > -1){
    var hospitalSalePolicy = DB.get("HospitalSalePolicy");
    var sql = "insert into hospital_sale_policy(hospital_sale_policy_userid,hospital_sale_policy_group_id,hospital_sale_policy_create_time,"+
              "hospital_sale_policy_hospital_id,hospital_sale_policy,hospital_sale_contacts_id,policy_percent,hospital_sale_policy_remark) values ";

    sql+="('"+req.session.user[0].id+"','"+req.session.user[0].group_id+"','"+new Date().format("yyyy-MM-dd")+"','"+req.body.hospital_id+"','"+req.body.hospital_sale_policy+"','"+req.body.hospital_sale_contacts_id+"','"+req.body.policy_percent+"','"+req.body.hospital_sale_policy_remark+"')"
    sql +=" ON DUPLICATE KEY UPDATE hospital_sale_policy_userid=VALUES(hospital_sale_policy_userid),hospital_sale_policy_group_id=VALUES(hospital_sale_policy_group_id),"+
          "hospital_sale_policy_create_time=VALUES(hospital_sale_policy_create_time),hospital_sale_policy=VALUES(hospital_sale_policy),hospital_sale_contacts_id=VALUES(hospital_sale_contacts_id),policy_percent=VALUES(policy_percent),hospital_sale_policy_remark=VALUES(hospital_sale_policy_remark)";

    hospitalSalePolicy.executeSql(sql,function(err,result){
      if(err){
        logger.error(req.session.user[0].realname + "修改销往单位政策出错" + err);
      }
      var message = req.session.user[0].realname+"修改销往单位政策";
      util.saveLogs(req.session.user[0].group_id,"-","-",message);
      res.json({"code":"000000",message:""});
    });
  }else{
    res.json({"code":"111112",message:"无权限"});
  }
});
//获取销售单位列表
router.post("/getHospitalSalePolicy",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",180,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var hospitals = DB.get("Hospitals");
  var sql = "select h.*,hsp.*,c.contacts_name from hospitals h left join hospital_sale_policy hsp on h.hospital_id = hsp.hospital_sale_policy_hospital_id "+
            "left join contacts c on c.contacts_id = hsp.hospital_sale_contacts_id "+
            "where h.delete_flag = '0' and h.group_id = '"+req.session.user[0].group_id+"' ";
  if(!util.isEmpty(req.body.data.hospitalsId)){
    sql += " and h.hospital_id like '%"+req.body.data.hospitalsId+"%'";
  }
  if(!util.isEmpty(req.body.data.hospital_type)){
    sql += " and h.hospital_type like '%"+req.body.data.hospital_type+"%'";
  }
  if(!util.isEmpty(req.body.data.contactId)){
    sql += " and hsp.hospital_sale_contacts_id like '%"+req.body.data.contactId+"%'";
  }
  if(!util.isEmpty(req.body.data.hospitalSaleFlag) && req.body.data.hospitalSaleFlag == '否'){
    sql += " and (hsp.hospital_sale_policy is null or hsp.hospital_sale_policy = '' ) and (hsp.hospital_sale_contacts_id is null or hsp.hospital_sale_contacts_id = '')";
  }else if(!util.isEmpty(req.body.data.hospitalSaleFlag) && req.body.data.hospitalSaleFlag == '是'){
    sql += " and hsp.hospital_sale_policy is not null or hsp.hospital_sale_contacts_id is not null ";
  }
  hospitals.countBySql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "查询销售单位，查询总数出错" + err);
    }
    req.body.page.totalCount = result;
    req.body.page.totalPage = Math.ceil(req.body.page.totalCount / req.body.page.limit);
    sql += " order by h.hospital_create_time desc limit " + req.body.page.start + "," + req.body.page.limit + "";
    hospitals.executeSql(sql,function(err,result){
      if(err){
        logger.error(req.session.user[0].realname + "查询销售单位出错" + err);
      }
      req.body.page.data = result;
      res.json({"code":"000000",message:req.body.page});
    });
  });
});
module.exports = router;
