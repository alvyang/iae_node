var express = require("express");
var logger = require('../utils/logger');
var util= require('../utils/global_util.js');
var router = express.Router();

//编辑报损
router.post("/editPurchaseRecoveryPay",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",186,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var purchaseRecovery = DB.get("PurchaseRecovery");
  if(req.body.purchase_recovery_pay_time){
    req.body.purchase_recovery_pay_time = new Date(req.body.purchase_recovery_pay_time).format("yyyy-MM-dd");
  }else{
    delete req.body.purchase_recovery_pay_time;
  }
  var params = {
    purchaserecovery_id:req.body.purchaserecovery_id,
    purchase_recovery_return_money:req.body.purchase_recovery_return_money,
		purchase_recovery_real_pay_money:req.body.purchase_recovery_real_pay_money,
    purchase_recovery_pay_number:req.body.purchase_recovery_pay_number,
    purchase_recovery_pay_time:req.body.purchase_recovery_pay_time,
    purchase_recovery_receiver_name:req.body.purchase_recovery_receiver_name,
    purchase_recovery_receiver_number:req.body.purchase_recovery_receiver_number,
    purchase_recovery_receiver_address:req.body.purchase_recovery_receiver_address,
    purchase_recovery_pay_remark:req.body.purchase_recovery_pay_remark,
  }
  var front_purchaserecovery = req.body.front_purchaserecovery;
  purchaseRecovery.update(params,'purchaserecovery_id',function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "修改采退应付记录出错" + err);
    }else{
      //更新流水
      updateBankDetail(req,params);
    }
    var message = req.session.user[0].realname+"修改采退应付记录。";
    util.saveLogs(req.session.user[0].group_id,front_purchaserecovery,JSON.stringify(params),message);
    res.json({"code":"000000",message:null});
  });
});
function updateBankDetail(req,params){
  var bankaccountdetail={};
  if(req.body.purchase_recovery_real_pay_money != '' && req.body.purchase_recovery_pay_time){
    bankaccountdetail.account_detail_deleta_flag = '0';
    bankaccountdetail.account_id = params.purchase_recovery_pay_number;
  }else{
    bankaccountdetail.account_detail_deleta_flag = '1';
  }
  bankaccountdetail.account_detail_money = -params.purchase_recovery_real_pay_money;
  bankaccountdetail.account_detail_time = params.purchase_recovery_pay_time;
  bankaccountdetail.account_detail_mark = "采退退积分"+req.body.purchaserecovery_number+req.body.product_unit+req.body.product_common_name;
  bankaccountdetail.flag_id = "purchase_recovery_"+params.purchaserecovery_id;
  var accountDetail = DB.get("AccountDetail");
  accountDetail.update(bankaccountdetail,'flag_id',function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "修改返款修改流水出错" + err);
    }
  });
}
//编辑报损
router.post("/editPurchaseRecovery",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",112,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var purchaseRecovery = DB.get("PurchaseRecovery");
  req.body.purchaserecovery_time = new Date(req.body.purchaserecovery_time).format("yyyy-MM-dd");
  if(req.body.purchaserecovery_return_money_time){
    req.body.purchaserecovery_return_money_time = new Date(req.body.purchaserecovery_return_money_time).format("yyyy-MM-dd");
  }else{
    delete req.body.purchaserecovery_return_money_time;
  }
  var params = {
    purchaserecovery_id:req.body.purchaserecovery_id,
		purchaserecovery_time:req.body.purchaserecovery_time,
    purchaserecovery_money:req.body.purchaserecovery_money,
    purchaserecovery_return_money_time:req.body.purchaserecovery_return_money_time,
    purchaserecovery_money:req.body.purchaserecovery_money,
    purchase_recovery_remark:req.body.purchase_recovery_remark
  }
  var front_purchaserecovery = req.body.front_purchaserecovery;
  purchaseRecovery.update(params,'purchaserecovery_id',function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "修改采退记录出错" + err);
    }
    var message = req.session.user[0].realname+"修改采退记录。";
    util.saveLogs(req.session.user[0].group_id,front_purchaserecovery,JSON.stringify(params),message);
    res.json({"code":"000000",message:null});
  });
});
//删除报损
router.post("/deletePurchasesRecovery",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",111,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var purchaseRecovery = DB.get("PurchaseRecovery");
  req.body.purchaserecovery_delete_flag = 1;
  purchaseRecovery.update(req.body,'purchaserecovery_id',function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "删除采退记录出错" + err);
    }
    var message = req.session.user[0].realname+"删采退记录。id："+req.body.purchaserecovery_id;
    util.saveLogs(req.session.user[0].group_id,"-","-",message);
    res.json({"code":"000000",message:null});
    //更新库存
    var batchStock = DB.get("BatchStock");
    var sqlstock = "update batch_stock set batch_stock_number=batch_stock_number+"+req.body.purchaserecovery_number+" where "+
              "batch_stock_purchase_id='"+req.body.purchaserecovery_purchase_id+"' and batch_stock_drug_id='"+req.body.purchaserecovery_drug_id+"'";
    batchStock.executeSql(sqlstock,function(err,result){
      if(err){
        logger.error(req.session.user[0].realname + "采退，修改批次库存出错" + err);
      }
    });
  });
});
router.post("/getPurchasesRecorveryPayList",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",110,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var sql = getPurchasesLossListSql(req);
  var batchStock = DB.get("BatchStock");
  batchStock.countBySql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "查询采退记录总数出错" + err);
    }
    var numSql = "select sum(num.purchase_recovery_return_money) as sm,sum(num.purchase_recovery_real_pay_money) as sm1 from ( " + sql + " ) num";
    batchStock.executeSql(numSql,function(err,money){
      if(err){
        logger.error(req.session.user[0].realname + "查询采退记录,统计出错" + err);
      }
      req.body.page.totalCount = result;
      req.body.page.sm = money && money[0].sm?Math.round(money[0].sm*100)/100:0;
      req.body.page.sm1 = money && money[0].sm1?Math.round(money[0].sm1*100)/100:0;
      req.body.page.sm2 = req.body.page.sm - req.body.page.sm1;
      req.body.page.totalPage = Math.ceil(req.body.page.totalCount / req.body.page.limit);
      sql += " order by pr.purchaserecovery_time desc,pr.purchaserecovery_create_time desc limit " + req.body.page.start + "," + req.body.page.limit + "";
      batchStock.executeSql(sql,function(err,result){
        if(err){
          logger.error(req.session.user[0].realname + "查询采退记录，出错" + err);
        }
        req.body.page.data = result;
        res.json({"code":"000000",message:req.body.page});
      });
    });
  });
});
//新增报损记录
router.post("/getPurchasesRecorveryList",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",110,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var sql = getPurchasesLossListSql(req);
  var batchStock = DB.get("BatchStock");
  batchStock.countBySql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "查询采退记录总数出错" + err);
    }
    req.body.page.totalCount = result;
    req.body.page.totalPage = Math.ceil(req.body.page.totalCount / req.body.page.limit);
    sql += " order by pr.purchaserecovery_time desc,pr.purchaserecovery_create_time desc limit " + req.body.page.start + "," + req.body.page.limit + "";
    batchStock.executeSql(sql,function(err,result){
      if(err){
        logger.error(req.session.user[0].realname + "查询采退记录，出错" + err);
      }
      req.body.page.data = result;
      res.json({"code":"000000",message:req.body.page});
    });
  });
});
function getPurchasesLossListSql(req){
  var sql = "select pr.*,d.*,bus.business_name,c.contacts_name from purchase_recovery pr left join drugs d on pr.purchaserecovery_product_code = d.product_code "+
            "left join contacts c on d.contacts_id = c.contacts_id "+
            "left join business bus on d.product_business = bus.business_id "+
            "where pr.purchaserecovery_delete_flag = '0' and pr.purchaserecovery_group_id = '"+req.session.user[0].group_id+"' "+
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
  if(req.body.data.recovery_status && req.body.data.recovery_status == '未付'){
    sql += " and (pr.purchase_recovery_real_pay_money is null or pr.purchase_recovery_real_pay_money = '')";
  }else if(req.body.data.recovery_status && req.body.data.recovery_status == '已付'){
    sql += " and pr.purchase_recovery_real_pay_money is not null and pr.purchase_recovery_real_pay_money != '' ";
  }
  if(req.body.data.time){
    var start = new Date(req.body.data.time[0]).format("yyyy-MM-dd");
    var end = new Date(req.body.data.time[1]).format("yyyy-MM-dd");
    sql += " and DATE_FORMAT(pr.purchaserecovery_time,'%Y-%m-%d') >= '"+start+"' and DATE_FORMAT(pr.purchaserecovery_time,'%Y-%m-%d') <= '"+end+"'";
  }
  if(req.body.data.recoveryReturnTime){
    var start = new Date(req.body.data.recoveryReturnTime[0]).format("yyyy-MM-dd");
    var end = new Date(req.body.data.recoveryReturnTime[1]).format("yyyy-MM-dd");
    sql += " and DATE_FORMAT(pr.purchase_recovery_pay_time,'%Y-%m-%d') >= '"+start+"' and DATE_FORMAT(pr.purchase_recovery_pay_time,'%Y-%m-%d') <= '"+end+"'";
  }
  return sql;
}
//新增采退记录
router.post("/savePurchasesrecorvery",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",113,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  req.body.purchaserecovery_time = new Date(req.body.purchaserecovery_time).format("yyyy-MM-dd");
  req.body.purchaserecovery_batch_stock_time = new Date(req.body.purchaserecovery_batch_stock_time).format("yyyy-MM-dd");

  if(req.body.purchaserecovery_return_money_time){
    req.body.purchaserecovery_return_money_time = new Date(req.body.purchaserecovery_return_money_time).format("yyyy-MM-dd");
  }else{
    delete req.body.purchaserecovery_return_money_time;
  }
  req.body.purchaserecovery_group_id = req.session.user[0].group_id;
  req.body.purchaserecovery_user_id = req.session.user[0].id;
  req.body.purchaserecovery_create_time = new Date();
  var batch_stock_purchase_id = req.body.purchaserecovery_purchase_id;
  var batch_stock_drug_id = req.body.purchaserecovery_drug_id;
  var productReturnMoney = req.body.product_return_money;
  var purchaseRecovery = DB.get("PurchaseRecovery");
  purchaseRecovery.insert(req.body,'purchaserecovery_id',function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "新增采进记录出错" + err);
    }
    res.json({"code":"000000",message:result});
    var message = req.session.user[0].realname+"新增采退记录。id："+result;
    util.saveLogs(req.session.user[0].group_id,"-",JSON.stringify(req.body),message);
    //添加流水
    saveRefundsPurchase(req,productReturnMoney,result);
    //更新库存
    var batchStock = DB.get("BatchStock");
    var sqlstock = "update batch_stock set batch_stock_number=batch_stock_number-"+req.body.purchaserecovery_number+" where "+
              "batch_stock_purchase_id='"+batch_stock_purchase_id+"' and batch_stock_drug_id='"+batch_stock_drug_id+"'";
    batchStock.executeSql(sqlstock,function(err,result){
      if(err){
        logger.error(req.session.user[0].realname + "采退，修改批次库存出错" + err);
      }
    });
  });
});
//新增 返款记录
function saveRefundsPurchase(req,productReturnMoney,id){
  //保存返款流水，如果保存时，还没有返款或者没有添加收款信息，则标识为删除
  var bankaccountdetail={};
  bankaccountdetail.account_detail_deleta_flag = '1';
  bankaccountdetail.account_detail_group_id = req.session.user[0].group_id;
  bankaccountdetail.flag_id = "purchase_recovery_"+id;
  bankaccountdetail.account_detail_create_time = new Date();
  bankaccountdetail.account_detail_create_userid = req.session.user[0].id;
  var accountDetail = DB.get("AccountDetail");
  accountDetail.insert(bankaccountdetail,'account_detail_id',function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "添加返款新增流水出错" + err);
    }
  });
}
//查询采退的批次库存记录
router.post("/getPurchasesRecorveryDrugs",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",110,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var batchStock = DB.get("BatchStock");
  var sql = "select d.*,bs.*,bus.business_name,c.contacts_name,r.refunds_real_money,p.purchase_number from drugs d left join batch_stock bs on d.product_id = bs.batch_stock_drug_id "+
            "left join contacts c on d.contacts_id = c.contacts_id "+
            "left join business bus on d.product_business = bus.business_id "+
            "left join refunds r on r.purchases_id = bs.batch_stock_purchase_id "+
            "left join purchase p on p.purchase_id = bs.batch_stock_purchase_id "+
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
