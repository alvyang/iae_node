var express = require("express");
var pinyin = require("node-pinyin");
var nodeExcel = require('excel-export');
var logger = require('../utils/logger');
var util= require('../utils/global_util.js');
var parse = require('csv-parse');
var XLSX = require("xlsx");
var router = express.Router();

//根据id查询政策
router.post("/getHospitalPolicyById",function(req,res){
  //添加完调货记录后，更新库存。
  var hospitalPolicyRecord = DB.get("HospitalPolicyRecord");
  var sql = "select * from hospital_policy_record where hospital_policy_delete_flag='0' and hospital_policy_group_id='"+req.session.user[0].group_id+"'"+
            " and hospital_policy_hospital_id = '"+req.body.hospitalId+"' and hospital_policy_drug_id = '"+req.body.drugId+"' ";
  hospitalPolicyRecord.executeSql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "根据Id查询政策出错" + err);
    }
    res.json({"code":"000000",message:result[0]});
  });
});
//删除政策
router.post("/deleteHospitalsPolicy",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",141,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  //添加完调货记录后，更新库存。
  var hospitalPolicyRecord = DB.get("HospitalPolicyRecord");
  var sql = "update hospital_policy_record set hospital_policy_delete_flag='1' where "+
            "hospital_policy_hospital_id='"+req.body.hospital_id+"' and hospital_policy_drug_id='"+req.body.product_id+"'";
  hospitalPolicyRecord.executeSql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "删除医院政策出错" + err);
    }
    var message = req.session.user[0].realname+"删除医院特殊政策记录。医院id："+req.body.hospital_id+"。药品id："+req.body.product_id;
    util.saveLogs(req.session.user[0].group_id,"-","-",message);
    res.json({"code":"000000",message:""});
  });
});
//编辑医院政策
router.post("/editHospitalPolicy",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",140,") > 0 || req.session.user[0].authority_code.indexOf(",139,") > 0){
    var hospitalPolicyRecord = DB.get("HospitalPolicyRecord");
    var sql = "insert into hospital_policy_record(hospital_policy_hospital_id,hospital_policy_drug_id,hospital_policy_price,"+
              "hospital_policy_return_money,hospital_policy_group_id,hospital_policy_create_time,hospital_policy_delete_flag";
        sql+=") values ('"+req.body.hospital_policy_hospital_id+"','"+req.body.hospital_policy_drug_id+"','"+req.body.hospital_policy_price+"',"+
             "'"+req.body.hospital_policy_return_money+"','"+req.session.user[0].group_id+"','"+new Date().format('yyyy-MM-dd')+"','0'";
        sql +=") ON DUPLICATE KEY UPDATE hospital_policy_price=VALUES(hospital_policy_price),hospital_policy_return_money=VALUES(hospital_policy_return_money),"+
              "hospital_policy_group_id=VALUES(hospital_policy_group_id),hospital_policy_create_time=VALUES(hospital_policy_create_time),hospital_policy_delete_flag=VALUES(hospital_policy_delete_flag)";
    hospitalPolicyRecord.executeSql(sql,function(err,result){
      if(err){
        logger.error(req.session.user[0].realname + "更新销售特殊政策，出错" + err);
      }
      var front_message = req.body.front_message?req.body.front_message:"-";
      delete req.body.front_message;
      var message = req.session.user[0].realname+"新增、修改医院特殊政策记录。医院id："+req.body.hospital_policy_hospital_id+"。药品id："+req.body.hospital_policy_drug_id;
      util.saveLogs(req.session.user[0].group_id,front_message,JSON.stringify(req.body),message);
      res.json({"code":"000000",message:""});
      updateSalePolicy(req);
    });
  }else{
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
});
//更新销售政策
function updateSalePolicy(req){
  var getSalePolicySql = "select sp.*,d.product_return_money,d.product_price from sale_policy sp left join drugs d on sp.sale_drug_id = d.product_id where sp.sale_drug_id = '"+req.body.hospital_policy_drug_id+"' and sp.sale_hospital_id = '"+req.body.hospital_policy_hospital_id+"' "+
                         "and sp.sale_policy_money != '' and sp.sale_policy_money is not null";
  var salePolicy = DB.get("SalePolicy");
  salePolicy.executeSql(getSalePolicySql,function(err,d){
    if(err){
      logger.error(req.session.user[0].realname + "修改药品医院特殊销售价，政策，查询销售政策出错" + err);
    }
    var copySql = "insert into sale_policy(sale_hospital_id,sale_drug_id,sale_policy_money,sale_policy_contact_id) values ";
    for(var i = 0 ; i < d.length ;i++){
      var price = !util.isEmptyAndZero(req.body.hospital_policy_price)?req.body.hospital_policy_price:d[i].product_price;
      var returnMoney = !util.isEmptyAndZero(req.body.hospital_policy_return_money)?req.body.hospital_policy_return_money:d[i].product_return_money;
      var t =  util.getShouldPayMoney(d[i].sale_policy_formula,price,returnMoney,d[i].sale_policy_percent,0,d[i].sale_policy_money);
      t = Math.round(t*100)/100;
      copySql += "('"+d[i].sale_hospital_id+"','"+d[i].sale_drug_id+"','"+t+"','"+d[i].sale_policy_contact_id+"'),";
    }
    copySql = copySql.substring(0,copySql.length-1);
    copySql += " ON DUPLICATE KEY UPDATE sale_policy_money=VALUES(sale_policy_money),sale_policy_contact_id=VALUES(sale_policy_contact_id)";
    salePolicy.executeSql(copySql,function(err,d){
      if(err){
        logger.error(req.session.user[0].realname + "修改药品医院特殊销售价，政策，修改销售政策出错" + err);
      }
      var message = req.session.user[0].realname+"修改药品医院特殊销售价，政策，更新销售政策";
      util.saveLogs(req.session.user[0].group_id,"-","-",message);
    });
  });
}
//查询销售政策
router.post("/getHospitalsPolicy",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",142,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var sql = getHospitalsPolicySql(req);
  var hospitalPolicyRecord = DB.get("HospitalPolicyRecord");
  hospitalPolicyRecord.countBySql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "查询医院特殊政策分页列表，统计总数出错" + err);
    }
    req.body.page.totalCount = result;
    req.body.page.totalPage = Math.ceil(req.body.page.totalCount / req.body.page.limit);
    sql += " order by dsp.hospital_policy_create_time desc limit " + req.body.page.start + "," + req.body.page.limit + "";
    hospitalPolicyRecord.executeSql(sql,function(err,result){
      if(err){
        logger.error(req.session.user[0].realname + "查询医院特殊政策分页列表，出错" + err);
      }
      req.body.page.data = result;
      res.json({"code":"000000",message:req.body.page});
    });
  });
});
function getHospitalsPolicySql(req){
  //药品连接政策
  var sql = "select * from hospital_policy_record sp left join drugs d on d.product_id = sp.hospital_policy_drug_id "+
            " where d.delete_flag='0' and d.group_id = '"+req.session.user[0].group_id+"' "+
            " and d.product_type in ('佣金','高打') and sp.hospital_policy_delete_flag ='0' and "+
            " sp.hospital_policy_group_id = '"+req.session.user[0].group_id+"' ";
  if(!util.isEmpty(req.body.data.hospitalId)){
    sql += " and sp.hospital_policy_hospital_id = '"+req.body.data.hospitalId+"' ";
  }
  if(!util.isEmpty(req.body.data.productCommonName)){
    sql += " and (d.product_common_name like '%"+req.body.data.productCommonName+"%' or d.product_name_pinyin like '%"+req.body.data.productCommonName+"%')";
  }
  if(!util.isEmpty(req.body.data.productCode)){
    sql += " and d.product_code = '"+req.body.data.productCode+"'";
  }
  //连接销往单位
  sql = "select dsch.*,h.hospital_name from ("+sql+") dsch left join hospitals h on dsch.hospital_policy_hospital_id = h.hospital_id "
  //连接商业
  sql = "select * from ("+sql+") dsp left join business b on dsp.product_business = b.business_id";
  return sql;
}
//查询销售未添加药品政策
router.post("/getHospitalsPolicyDrugs",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",139,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var sql = getHospitalsPolicyDrugs(req);
  var hospitalPolicyRecord = DB.get("HospitalPolicyRecord");
  hospitalPolicyRecord.countBySql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "查询医院特殊政策，选择未添加药品分页列表，统计总数出错" + err);
    }
    req.body.page.totalCount = result;
    req.body.page.totalPage = Math.ceil(req.body.page.totalCount / req.body.page.limit);
    sql += " order by dsp.product_create_time desc limit " + req.body.page.start + "," + req.body.page.limit + "";
    hospitalPolicyRecord.executeSql(sql,function(err,result){
      if(err){
        logger.error(req.session.user[0].realname + "查询医院特殊政策，选择未添加药品分页列表，出错" + err);
      }
      req.body.page.data = result;
      res.json({"code":"000000",message:req.body.page});
    });
  });
});
function getHospitalsPolicyDrugs(req){
  //药品连接政策
  var sql = "select * from drugs d left join hospital_policy_record sp on d.product_id = sp.hospital_policy_drug_id "+
            " and (sp.hospital_policy_hospital_id = '"+req.body.data.hospitalId+"' or sp.hospital_policy_hospital_id is null) "+
            " where d.delete_flag='0' and d.group_id = '"+req.session.user[0].group_id+"' "+
            " and ((sp.hospital_policy_return_money is null or sp.hospital_policy_return_money ='') "+
            " and (sp.hospital_policy_price is null or sp.hospital_policy_price ='') "+
            " or (sp.hospital_policy_delete_flag is null or sp.hospital_policy_delete_flag ='1')) ";
  if(!util.isEmpty(req.body.data.productCommonName)){
    sql += " and (d.product_common_name like '%"+req.body.data.productCommonName+"%' or d.product_name_pinyin like '%"+req.body.data.productCommonName+"%')";
  }
  if(!util.isEmpty(req.body.data.productCode)){
    sql += " and d.product_code = '"+req.body.data.productCode+"'";
  }
  //连接销往单位
  sql = "select dsch.*,h.hospital_name from ("+sql+") dsch left join hospitals h on dsch.hospital_policy_hospital_id = h.hospital_id "
  //连接商业
  sql = "select * from ("+sql+") dsp left join business b on dsp.product_business = b.business_id";
  return sql;
}
module.exports = router;
