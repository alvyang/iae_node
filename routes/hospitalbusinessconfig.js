var express = require("express");
var logger = require('../utils/logger');
var util = require('../utils/global_util');
var router = express.Router();

//编辑配置
router.post("/editBuninessConfig",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",79,") > -1){
    var config = DB.get("HospitalBusinessConfig");
  	req.body.hb_group_id = req.session.user[0].group_id;
    req.body.hb_start_time = new Date(req.body.hb_start_time).format('yyyy-MM-dd');
    if(req.body.hb_config_id){
      var front_message = req.body.front_message;
      config.update(req.body,'hb_config_id',function(err,result){
        if(err){
          logger.error(req.session.user[0].realname + "修改商业配置出错" + err);
        }
        var message = req.session.user[0].realname+"修改商业配置。id："+req.body.hb_config_id;
        util.saveLogs(req.session.user[0].group_id,front_message,JSON.stringify(req.body),message);
        res.json({"code":"000000",message:null});
      });
    }else{
      delete req.body.hb_config_id;
      config.insert(req.body,'hb_config_id',function(err,result){
        if(err){
          logger.error(req.session.user[0].realname + "新增商业配置出错" + err);
        }
        var message = req.session.user[0].realname+"新增商业配置。id："+result;
        util.saveLogs(req.session.user[0].group_id,"-",JSON.stringify(req.body),message);
        res.json({"code":"000000",message:result});
      });
    }
  }else{
    res.json({"code":"111112",message:"无权限"});
  }
});
//获取商务提成列表
router.post("/getBuninessConfig",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",79,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var config = DB.get("HospitalBusinessConfig");
  //拼接sql
  var sql = getBusinessConfig(req);
  config.countBySql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "查询商业提成，查询总数出错" + err);
    }
    req.body.page.totalCount = result;
    req.body.page.totalPage = Math.ceil(req.body.page.totalCount / req.body.page.limit);
    sql += " order by hb.hospital_name,hb.business_name limit " + req.body.page.start + "," + req.body.page.limit + "";
    config.executeSql(sql,function(err,result){
      if(err){
        logger.error(req.session.user[0].realname + "查询商业提成出错" + err);
      }
      req.body.page.data = result;
      res.json({"code":"000000",message:req.body.page});
    });
  });
});
function getBusinessConfig(req){
  //全连接查询医院 商业
  var sql = "select * from hospitals h join business b where h.delete_flag = '0' and h.group_id = '"+req.session.user[0].group_id+"' "+
            "and b.business_delete_flag = '0' and b.business_group_id = '"+req.session.user[0].group_id+"' "+
            "and h.hospital_type like '%销售单位%'";
  if(!util.isEmpty(req.body.data.business_id)){
    sql += "and b.business_id = '"+req.body.data.business_id+"'";
  }
  if(!util.isEmpty(req.body.data.hospital_id)){
    sql += "and h.hospital_id = '"+req.body.data.hospital_id+"'";
  }
  //多对多查询 查询医院商业提成配置
      sql = "select * from ("+sql+") hb left join hospital_business_config hbc on hb.hospital_id = hbc.hb_hospital_id "+
            "and hb.business_id = hbc.hb_business_id";

  return sql;
};
module.exports = router;
