var express = require("express");
var logger = require('../utils/logger');
var util= require('../utils/global_util.js');
var router = express.Router();

//编辑报损
router.post("/editPurchaseLoss",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",116,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var purchaseLoss = DB.get("PurchaseLoss");
  req.body.purchaseloss_time = new Date(req.body.purchaseloss_time).format("yyyy-MM-dd");
  var params = {
    purchaseloss_id:req.body.purchaseloss_id,
		purchaseloss_time:req.body.purchaseloss_time,
    purchaseloss_money:req.body.purchaseloss_money,
    purchase_loss_remark:req.body.purchase_loss_remark,
    purchase_loss_number:req.body.purchase_loss_number,
    purchase_loss_money:req.body.purchase_loss_money,
  }
  var front_purchaseloss = req.body.front_purchaseloss;
  purchaseLoss.update(params,'purchaseloss_id',function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "修改报损记录出错" + err);
    }
    var message = req.session.user[0].realname+"修改报损记录。";
    util.saveLogs(req.session.user[0].group_id,front_purchaseloss,JSON.stringify(params),message);
    updatePurchaseLoss(req,params.purchaseloss_id);
    res.json({"code":"000000",message:null});
  });
});
//更新流水
function updatePurchaseLoss(req,purchaseLossId){
  var bankaccountdetail={};
  if(req.body.purchase_loss_money != '' && req.body.purchase_loss_number){
    bankaccountdetail.account_detail_deleta_flag = '0';
    bankaccountdetail.account_id = req.body.purchase_loss_number;
  }else{
    bankaccountdetail.account_detail_deleta_flag = '1';
  }
  bankaccountdetail.account_detail_money = -req.body.purchase_loss_money;
  bankaccountdetail.account_detail_time = req.body.purchaseloss_time;
  bankaccountdetail.account_detail_mark = "报损"+req.body.purchaseloss_number+req.body.product_unit+req.body.product_common_name;
  bankaccountdetail.account_detail_group_id = req.session.user[0].group_id;
  bankaccountdetail.flag_id = "purchase_loss_"+purchaseLossId;
  var accountDetail = DB.get("AccountDetail");
  accountDetail.update(bankaccountdetail,'flag_id',function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "修改返款修改流水出错" + err);
    }
  });
}
//删除报损
router.post("/deletePurchasesLoss",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",115,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var purchaseLoss = DB.get("PurchaseLoss");
  req.body.purchaseloss_delete_flag = 1;
  purchaseLoss.update(req.body,'purchaseloss_id',function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "删除报损记录出错" + err);
    }
    var message = req.session.user[0].realname+"删除报损记录。id："+req.body.purchaseloss_id;
    util.saveLogs(req.session.user[0].group_id,"-","-",message);
    res.json({"code":"000000",message:null});
    //更新库存
    var batchStock = DB.get("BatchStock");
    var sqlstock = "update batch_stock set batch_stock_number=batch_stock_number+"+req.body.purchaseloss_number+" where "+
              "batch_stock_purchase_id='"+req.body.purchaseloss_purchase_id+"' and batch_stock_drug_id='"+req.body.purchaseloss_drug_id+"'";
    batchStock.executeSql(sqlstock,function(err,result){
      if(err){
        logger.error(req.session.user[0].realname + "报损，修改批次库存出错" + err);
      }
    });
  });
});
//新增报损记录
router.post("/getPurchasesLossList",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",114,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var sql = getPurchasesLossListSql(req);
  var batchStock = DB.get("BatchStock");
  batchStock.countBySql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "查询报损记录总数出错" + err);
    }
    req.body.page.totalCount = result;
    req.body.page.totalPage = Math.ceil(req.body.page.totalCount / req.body.page.limit);
    sql += " order by pl.purchaseloss_time desc,pl.purchaseloss_create_time desc limit " + req.body.page.start + "," + req.body.page.limit + "";
    batchStock.executeSql(sql,function(err,result){
      if(err){
        logger.error(req.session.user[0].realname + "查询报损记录，出错" + err);
      }
      req.body.page.data = result;
      res.json({"code":"000000",message:req.body.page});
    });
  });
});
function getPurchasesLossListSql(req){
  var sql = "select pl.*,d.*,bus.business_name,c.contacts_name from purchase_loss pl left join drugs d on pl.purchaseloss_product_code = d.product_code "+
            "left join contacts c on d.contacts_id = c.contacts_id "+
            "left join business bus on d.product_business = bus.business_id "+
            "where pl.purchaseloss_delete_flag = '0' and pl.purchaseloss_group_id = '"+req.session.user[0].group_id+"' "+
            "and d.delete_flag = '0' and d.group_id = '"+req.session.user[0].group_id+"' ";
  if(!util.isEmpty(req.body.data.productCommonName)){
    sql += " and (d.product_common_name like '%"+req.body.data.productCommonName+"%' or d.product_name_pinyin like '%"+req.body.data.productCommonName+"%')";
  }
  if(!util.isEmpty(req.body.data.contactId)){
    sql += " and d.contacts_id = '"+req.body.data.contactId+"'"
  }
  if(!util.isEmpty(req.body.data.product_makesmakers)){
    sql += " and d.product_makesmakers like '%"+req.body.data.product_makesmakers+"%'"
  }
  if(!util.isEmpty(req.body.data.product_code)){
    sql += " and d.product_code = '"+req.body.data.product_code+"'"
  }
  if(!util.isEmpty(req.body.data.business)){
    sql += " and d.product_business = '"+req.body.data.business+"'"
  }
  if(req.body.data.time){
    var start = new Date(req.body.data.time[0]).format("yyyy-MM-dd");
    var end = new Date(req.body.data.time[1]).format("yyyy-MM-dd");
    sql += " and DATE_FORMAT(pl.purchaseloss_time,'%Y-%m-%d') >= '"+start+"' and DATE_FORMAT(pl.purchaseloss_time,'%Y-%m-%d') <= '"+end+"'";
  }
  return sql;
}
//新增报损记录
router.post("/savePurchasesLoss",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",117,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  if(req.body.purchaseloss_time){
    req.body.purchaseloss_time = new Date(req.body.purchaseloss_time).format("yyyy-MM-dd");
  }else{
    delete req.body.purchaseloss_time;
  }
  if(req.body.purchaseloss_batch_stock_time){
    req.body.purchaseloss_batch_stock_time = new Date(req.body.purchaseloss_batch_stock_time).format("yyyy-MM-dd");
  }else{
    delete req.body.purchaseloss_batch_stock_time;
  }
  req.body.purchaseloss_group_id = req.session.user[0].group_id;
  req.body.purchaseloss_user_id = req.session.user[0].id;
  req.body.purchaseloss_create_time = new Date();
  var batch_stock_purchase_id = req.body.purchaseloss_purchase_id;
  var batch_stock_drug_id = req.body.purchaseloss_drug_id;
  var productUnit = req.body.product_unit;
  var productCommonName = req.body.product_common_name;
  var purchaseLoss = DB.get("PurchaseLoss");
  purchaseLoss.insert(req.body,'purchaseloss_id',function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "新增报损记录出错" + err);
    }
    var message = req.session.user[0].realname+"新增报损记录。id："+req.body.purchaseloss_id;
    util.saveLogs(req.session.user[0].group_id,"-",JSON.stringify(req.body),message);
    res.json({"code":"000000",message:result});
    //更新流水
    savePurchaseLoss(req,result,productUnit,productCommonName);
    //更新库存
    var batchStock = DB.get("BatchStock");
    var sqlstock = "update batch_stock set batch_stock_number=batch_stock_number-"+req.body.purchaseloss_number+" where "+
              "batch_stock_purchase_id='"+batch_stock_purchase_id+"' and batch_stock_drug_id='"+batch_stock_drug_id+"'";
    batchStock.executeSql(sqlstock,function(err,result){
      if(err){
        logger.error(req.session.user[0].realname + "报损，修改批次库存出错" + err);
      }
    });
  });
});
//更新流水
function savePurchaseLoss(req,purchaseLossId,productUnit,productCommonName){
  var bankaccountdetail={};
  if(req.body.purchase_loss_money != '' && req.body.purchase_loss_number){
    bankaccountdetail.account_detail_deleta_flag = '0';
    bankaccountdetail.account_id = req.body.purchase_loss_number;
  }else{
    bankaccountdetail.account_detail_deleta_flag = '1';
  }
  bankaccountdetail.account_detail_money = -req.body.purchase_loss_money;
  bankaccountdetail.account_detail_time = req.body.purchaseloss_time;
  bankaccountdetail.account_detail_mark = "报损"+req.body.purchaseloss_number+productUnit+productCommonName;
  bankaccountdetail.account_detail_group_id = req.session.user[0].group_id;
  bankaccountdetail.account_detail_create_userid = req.session.user[0].id;
  bankaccountdetail.flag_id = "purchase_loss_"+purchaseLossId;
  var accountDetail = DB.get("AccountDetail");
  req.body.account_detail_create_time = new Date();
  accountDetail.insert(bankaccountdetail,'account_detail_id',function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "添加报损新增流水出错" + err);
    }
    var message = req.session.user[0].realname+"添加报损新增流水。id："+result;
    util.saveLogs(req.session.user[0].group_id,"-",JSON.stringify(req.body),message);
  });
}
//查询报损的批次库存记录
router.post("/getPurchasesLossDrugs",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",114,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var batchStock = DB.get("BatchStock");
  var sql = "select d.*,bs.*,bus.business_name,c.contacts_name from drugs d left join batch_stock bs on d.product_id = bs.batch_stock_drug_id "+
            "left join contacts c on d.contacts_id = c.contacts_id "+
            "left join business bus on d.product_business = bus.business_id "+
            " where bs.tag_type_delete_flag = '0' and bs.tag_type_group_id = '"+req.session.user[0].group_id+"' "+
            " and d.delete_flag = '0' and d.group_id = '"+req.session.user[0].group_id+"' and bs.batch_stock_number != 0";
  if(!util.isEmpty(req.body.data.productCommonName)){
    sql += " and (d.product_common_name like '%"+req.body.data.productCommonName+"%' or d.product_name_pinyin like '%"+req.body.data.productCommonName+"%')";
  }
  if(!util.isEmpty(req.body.data.contactId)){
    sql += " and d.contacts_id = '"+req.body.data.contactId+"'"
  }
  if(!util.isEmpty(req.body.data.product_makesmakers)){
    sql += " and d.product_makesmakers like '%"+req.body.data.product_makesmakers+"%'"
  }
  if(!util.isEmpty(req.body.data.product_code)){
    sql += " and d.product_code = '"+req.body.data.product_code+"'"
  }
  if(!util.isEmpty(req.body.data.business)){
    sql += " and d.product_business = '"+req.body.data.business+"'"
  }
  if(req.body.data.time){
    var start = new Date(req.body.data.time[0]).format("yyyy-MM-dd");
    var end = new Date(req.body.data.time[1]).format("yyyy-MM-dd");
    sql += " and DATE_FORMAT(bs.batch_stock_time,'%Y-%m-%d') >= '"+start+"' and DATE_FORMAT(bs.batch_stock_time,'%Y-%m-%d') <= '"+end+"'";
  }
  batchStock.countBySql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "报损，查询批次库存，查询总数出错" + err);
    }
    req.body.page.totalCount = result;
    req.body.page.totalPage = Math.ceil(req.body.page.totalCount / req.body.page.limit);
    sql += " order by bs.batch_stock_time desc limit " + req.body.page.start + "," + req.body.page.limit + "";
    batchStock.executeSql(sql,function(err,result){
      if(err){
        logger.error(req.session.user[0].realname + "报损，查询批次库存" + err);
      }
      req.body.page.data = result;
      res.json({"code":"000000",message:req.body.page});
    });
  });

});

module.exports = router;
