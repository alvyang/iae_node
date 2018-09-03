var express = require("express");
var nodeExcel = require('excel-export');
var logger = require('../utils/logger');
var fs = require('fs');
var util= require('../utils/global_util.js');
var router = express.Router();

//新增调货记录
router.post("/saveAllot",function(req,res){
  if(req.session.user[0].authority_code.indexOf("58") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  req.body.allot_time = new Date(req.body.allot_time).format("yyyy-MM-dd");
  if(req.body.allot_return_time){
    req.body.allot_return_time = new Date(req.body.allot_return_time).format("yyyy-MM-dd");
  }else{
    delete req.body.allot_return_time;
  }
  var productType = req.body.product_type;
  var stock = req.body.stock;
  var productId = req.body.allot_drug_id;
  delete req.body.product_type;
  delete req.body.stock;
  var allot = DB.get("Allot");
  req.body.allot_group_id = req.session.user[0].group_id;
  allot.insertIncrement(req.body,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "新增调货记录出错" + err);
    }
    res.json({"code":"000000",message:result});
  });

  //添加完调货记录后，更新库存。
  if(productType == '高打' || productType== '高打(底价)'){
    var drugsStock = {
      product_id:productId,
      stock:stock-req.body.allot_number
    }
    var drugs = DB.get("Drugs");
    drugs.update(drugsStock,'product_id',function(err,result){
      if(err){
        logger.error(req.session.user[0].realname + "新增调货,更新库存出错" + err);
      }
    });
  }
});
//编辑调货记录
router.post("/editAllot",function(req,res){
  if(req.session.user[0].authority_code.indexOf("59") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var allot = DB.get("Allot");
  req.body.allot_time = new Date(req.body.allot_time).format("yyyy-MM-dd");
  if(req.body.allot_return_time){
    req.body.allot_return_time = new Date(req.body.allot_return_time).format("yyyy-MM-dd");
  }else{
    delete req.body.allot_return_time;
  }
  var params = {
    allot_id:req.body.allot_id,
    allot_number:req.body.allot_number,
		allot_time:req.body.allot_time,
		allot_hospital:req.body.allot_hospital,
		allot_money:req.body.allot_money,
		allot_return_price:req.body.allot_return_price,
		allot_return_money:req.body.allot_return_money,
		allot_return_time:req.body.allot_return_time,
		allot_return_flag:req.body.allot_return_flag
  }
  allot.update(params,'allot_id',function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "修改调货记录出错" + err);
    }
    res.json({"code":"000000",message:null});
  });

  //添加完调货记录后，更新库存。
  if(req.body.product_type == '高打' || req.body.product_type == '高打(底价)'){
    var drugsStock = {
      product_id:req.body.product_id,
      stock:req.body.stock-req.body.allot_number + parseInt(req.body.allot_number_temp)
    }
    var drugs = DB.get("Drugs");
    drugs.update(drugsStock,'product_id',function(err,result){
      if(err){
        logger.error(req.session.user[0].realname + "修改调货记录，更新库存出错" + err);
      }
    });
  }
});
//删除菜单
router.post("/deleteAllot",function(req,res){
  if(req.session.user[0].authority_code.indexOf("60") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var allot = DB.get("Allot");
  req.body.allot_delete_flag = 1;
  var productType = req.body.product_type;
  var stock = parseInt(req.body.stock);
  var productId = req.body.product_id;
  var allotNumber = parseInt(req.body.allot_number);
  delete req.body.product_type;
  delete req.body.stock;
  delete req.body.product_id;
  delete req.body.allot_number;
  allot.update(req.body,'allot_id',function(err,result){
    res.json({"code":"000000",message:null});
  });
  //添加完调货记录后，更新库存。
  if(productType == '高打' || productType == '高打(底价)'){
    var drugsStock = {
      product_id:productId,
      stock:stock+allotNumber
    }
    var drugs = DB.get("Drugs");
    drugs.update(drugsStock,'product_id',function(err,result){
      if(err){
        logger.error(req.session.user[0].realname + "删除调货记录出错" + err);
      }
    });
  }
});
//获取调货列表
router.post("/getAllot",function(req,res){
  if(req.session.user[0].authority_code.indexOf("61") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var allot = DB.get("Allot");
  var sql = getAllotSql(req);
  allot.countBySql(sql,function(err,result){//查询调货总数
    if(err){
      logger.error(req.session.user[0].realname + "查询调货列表，查询调货总数出错" + err);
    }
    var numSql = "select sum(num.allot_return_money) as returnMoney from ( " + sql + " ) num";
    allot.executeSql(numSql,function(err,returnMoney){//查询调货应返金额
      if(err){
        logger.error(req.session.user[0].realname + "查询调货列表，计算返款金额出错" + err);
      }
      req.body.page.returnMoney = returnMoney && returnMoney[0].returnMoney?returnMoney[0].returnMoney.toFixed(2):0;
      req.body.page.totalCount = result;
      req.body.page.totalPage = Math.ceil(req.body.page.totalCount / req.body.page.limit);
      sql += " order by a.allot_time desc limit " + req.body.page.start + "," + req.body.page.limit + "";
      allot.executeSql(sql,function(err,result){
        if(err){
          logger.error(req.session.user[0].realname + "查询调货列表出错" + err);
        }
        req.body.page.data = result;
        res.json({"code":"000000",message:req.body.page});
      });
    });

  });
});
function getAllotSql(req){
  var sql = "select * from allot a left join drugs d on a.allot_drug_id = d.product_id where a.allot_delete_flag = '0' and a.allot_group_id = '"+req.session.user[0].group_id+"' ";

  if(req.body.data.productCommonName){
    sql += " and (d.product_common_name like '%"+req.body.data.productCommonName+"%' or d.product_name_pinyin like '%"+req.body.data.productCommonName+"%')";
  }
  if(req.body.data.allot_hospital){
    sql += " and a.allot_hospital = '"+req.body.data.allot_hospital+"'"
  }
  if(req.body.data.product_code){
    sql += " and d.product_code = '"+req.body.data.product_code+"'"
  }
  if(req.body.data.allot_time){
    var start = new Date(req.body.data.allot_time[0]).format("yyyy-MM-dd");
    var end = new Date(req.body.data.allot_time[1]).format("yyyy-MM-dd");
    sql += " and DATE_FORMAT(a.allot_time,'%Y-%m-%d') >= '"+start+"' and DATE_FORMAT(a.allot_time,'%Y-%m-%d') <= '"+end+"'";
  }
  if(req.body.data.allot_return_flag){
    sql += " and a.allot_return_flag = '"+req.body.data.allot_return_flag+"'"
  }
  return sql;
}
//分组查询，获取备注
router.post("/getHospitals",function(req,res){
  var allot = DB.get("Allot");
  var sql = "select a.allot_hospital from allot a where a.allot_delete_flag = '0' and a.allot_group_id = '"+req.session.user[0].group_id+"' and a.allot_hospital is not null and a.allot_hospital !='' group by a.allot_hospital"
  allot.executeSql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "分组查询医院出错" + err);
    }
    res.json({"code":"000000",message:result});
  });
});
module.exports = router;
