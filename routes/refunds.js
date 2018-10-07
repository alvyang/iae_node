var express = require("express");
var logger = require('../utils/logger');
var router = express.Router();

//新增返款记录
router.post("/saveRefunds",function(req,res){
  if(req.session.user[0].authority_code.indexOf("45") > 0 || req.session.user[0].authority_code.indexOf("47") > 0){
    var refunds = DB.get("Refunds");
    if(req.body.refunds_should_time){
      req.body.refunds_should_time = new Date(req.body.refunds_should_time).format('yyyy-MM-dd');
    }else{
      req.body.refunds_should_time = null;
    }
    if(req.body.refunds_real_time){
      req.body.refunds_real_time = new Date(req.body.refunds_real_time).format('yyyy-MM-dd');
    }else{
      req.body.refunds_real_time = null;
    }
    delete req.body.refunds_id;
    var accountDetail = req.body.account_detail;
    delete req.body.account_detail;
    refunds.insert(req.body,'refunds_id',function(err,result){
      if(err){
        logger.error(req.session.user[0].realname + "新增返款记录出错" + err);
      }
      res.json({"code":"000000",message:result});
    });
    //保存返款流水，如果保存时，还没有返款或者没有添加收款信息，则标识为删除
    var bankaccountdetail={};
    if(!req.body.receiver){
      bankaccountdetail.account_detail_deleta_flag = '1';
    }else{
      bankaccountdetail.account_id = req.body.receiver;
    }
    bankaccountdetail.account_detail_money = req.body.refunds_real_money;
    bankaccountdetail.account_detail_time = req.body.refunds_real_time;
    bankaccountdetail.account_detail_mark = accountDetail;
    bankaccountdetail.account_detail_group_id = req.session.user[0].group_id;
    bankaccountdetail.flag_id = req.body.sales_id?"sale_"+req.body.sales_id:"purchase_"+req.body.purchases_id;

    var accountDetail = DB.get("AccountDetail");
    accountDetail.insert(bankaccountdetail,'account_detail_id',function(err,result){
      if(err){
        logger.error(req.session.user[0].realname + "添加返款新增流水出错" + err);
      }
    });
  }else{
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
});
//编辑返款记录
router.post("/editRefunds",function(req,res){
  if(req.session.user[0].authority_code.indexOf("45") > 0 || req.session.user[0].authority_code.indexOf("47") > 0){
    var refunds = DB.get("Refunds");
    if(req.body.refunds_should_time){
      req.body.refunds_should_time = new Date(req.body.refunds_should_time).format('yyyy-MM-dd');
    }else{
      req.body.refunds_should_time = null;
    }
    if(req.body.refunds_real_time){
      req.body.refunds_real_time = new Date(req.body.refunds_real_time).format('yyyy-MM-dd');
    }else{
      req.body.refunds_real_time = null;
    }
    var accountDetail = req.body.account_detail;
    delete req.body.account_detail;
    refunds.update(req.body,'refunds_id',function(err,result){
      if(err){
        logger.error(req.session.user[0].realname + "修改返款记录出错" + err);
      }
      res.json({"code":"000000",message:null});
    });

    //保存返款流水，如果保存时，还没有返款或者没有添加收款信息，则标识为删除
    var bankaccountdetail={};
    if(!req.body.receiver){
      bankaccountdetail.account_detail_deleta_flag = '1';
    }else{
      bankaccountdetail.account_detail_deleta_flag = '0';
      bankaccountdetail.account_id = req.body.receiver;
    }
    bankaccountdetail.account_detail_money = req.body.refunds_real_money;
    bankaccountdetail.account_detail_time = req.body.refunds_real_time;
    bankaccountdetail.account_detail_mark = accountDetail;
    bankaccountdetail.account_detail_group_id = req.session.user[0].group_id;
    bankaccountdetail.flag_id = req.body.sales_id?"sale_"+req.body.sales_id:"purchase_"+req.body.purchases_id;

    var accountDetail = DB.get("AccountDetail");
    accountDetail.update(bankaccountdetail,'flag_id',function(err,result){
      if(err){
        logger.error(req.session.user[0].realname + "修改返款修改流水出错" + err);
      }
    });
  }else{
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
});
//获取高打返款列表
router.post("/getPurchaseRefunds",function(req,res){
  if(req.session.user[0].authority_code.indexOf("44") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var refunds = DB.get("Refunds");
  var sql = getPurchasesSql(req);
  refunds.countBySql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "查询高打返款列表，统计总数出错" + err);
    }
    var numSql = "select sum(num.refunds_should_money) as rsm,sum(num.refunds_real_money) as rrm,sum(num.service_charge) as sc from ( " + sql + " ) num";
    refunds.executeSql(numSql,function(err,refund){
      if(err){
        logger.error(req.session.user[0].realname + "查询高打返款列表，统计金额出错" + err);
      }
      req.body.page.rsm = refund&&refund[0].rsm?refund[0].rsm.toFixed(2):0;
      req.body.page.rrm = refund&&refund[0].rrm?refund[0].rrm.toFixed(2):0;
      req.body.page.sc = refund&&refund[0].sc?refund[0].sc.toFixed(2):0;
      req.body.page.totalCount = result;
      req.body.page.totalPage = Math.ceil(req.body.page.totalCount / req.body.page.limit);
      sql += " order by rbus.time desc,rbus.purchase_id desc limit " + req.body.page.start + "," + req.body.page.limit + "";
      refunds.executeSql(sql,function(err,result){
        if(err){
          logger.error(req.session.user[0].realname + "查询高打返款列表" + err);
        }
        req.body.page.data = result;
        res.json({"code":"000000",message:req.body.page});
      });
    });
  });
});
//采购返款sql
function getPurchasesSql(req){
  //返款记录需要手动修改的时候保存，所以，在查询所有返款时，要用采购记录，左连接返款记录
  //返款类型1：按销售返款 2：表示是采购（高打）返款 3：无返款
  var prsql = "select * from purchase pr left join refunds r on pr.purchase_id = r.purchases_id where pr.purchase_return_flag='2' and pr.make_money_time is not null";
  if(req.body.data.status){
    var s = req.body.data.status=="已返"?"r.refunds_real_time is not null && r.refunds_real_money is not null":"r.refunds_real_time is null && (r.refunds_real_money is null || r.refunds_real_money = '')";
    prsql += " and "+s;
  }
  if(req.body.data.returnTime){
    var start = new Date(req.body.data.returnTime[0]).format("yyyy-MM-dd");
    var end = new Date(req.body.data.returnTime[1]).format("yyyy-MM-dd");
    prsql += " and (DATE_FORMAT(r.refunds_should_time,'%Y-%m-%d') >= '"+start+"' and DATE_FORMAT(r.refunds_should_time,'%Y-%m-%d') <= '"+end+"')";
  }
  //连接查询收款账号信息
  prsql = "select prb.*,b.account_number,b.account_person from ("+prsql+") prb left join bank_account b on prb.receiver = b.account_id"
  //连接查询联系人、药品信息
  var sql = "select p.*,d.product_code,d.product_business,d.product_floor_price,d.product_high_discount,d.contacts_name,d.product_return_explain,"+
            "d.product_type,d.product_return_money,d.product_return_discount,d.product_common_name,d.product_specifications,"+
            "d.product_supplier,d.product_makesmakers,d.product_unit,d.product_packing"+//药品属性
            " from ("+prsql+") p left join (select dd.*,c.contacts_name from drugs dd left join contacts c on dd.contacts_id = c.contacts_id) d "+
            "on p.drug_id = d.product_id where p.delete_flag = '0' and d.group_id = '"+req.session.user[0].group_id+"'";
  if(req.body.data.productCommonName){
    sql += " and (d.product_common_name like '%"+req.body.data.productCommonName+"%' or d.product_name_pinyin like '%"+req.body.data.productCommonName+"%')";
  }
  if(req.body.data.contactId){
    sql += " and d.contacts_id = '"+req.body.data.contactId+"'"
  }
  if(req.body.data.refundser){
    //查询出与该返款人相关的所有联系人id
    var contactIdSql = "select cp.drug_id from purchase cp left join refunds cr on cp.purchase_id = cr.purchases_id "+
                       "where cp.purchase_return_flag='2' and cp.make_money_time is not null and cp.delete_flag = '0' and cp.group_id = '"+req.session.user[0].group_id+"' ";
        contactIdSql += "and cr.refundser = '"+req.body.data.refundser+"'";
    contactIdSql = "select cdc.contacts_id from ("+contactIdSql+") csr left join "+
                   "(select cd.product_id,cc.contacts_id from drugs cd left join contacts cc on cd.contacts_id = cc.contacts_id) cdc "+
                   "on csr.drug_id = cdc.product_id ";
    sql += " and d.contacts_id in ("+contactIdSql+")";
  }
  if(req.body.data.product_code){
    sql += " and d.product_code = '"+req.body.data.product_code+"'"
  }
  if(req.body.data.business){
    sql += " and d.product_business = '"+req.body.data.business+"'"
  }
  if(req.body.data.time){
    var start = new Date(req.body.data.time[0]).format("yyyy-MM-dd");
    var end = new Date(req.body.data.time[1]).format("yyyy-MM-dd");
    sql += " and DATE_FORMAT(p.time,'%Y-%m-%d') >= '"+start+"' and DATE_FORMAT(p.time,'%Y-%m-%d') <= '"+end+"'";
  }
  sql = "select rbus.*,bus.business_name from ("+sql+") rbus left join business bus on rbus.product_business = bus.business_id ";
  return sql;
}
//获取返款
router.post("/getSaleRefunds",function(req,res){
  if(req.session.user[0].authority_code.indexOf("46") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var refunds = DB.get("Refunds");
  var sql = getQuerySql(req);
  refunds.countBySql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "查询佣金返款列表，统计总数出错" + err);
    }
    var numSql = "select sum(num.refunds_should_money) as rsm,sum(num.refunds_real_money) as rrm,sum(num.service_charge) as sc from ( " + sql + " ) num";
    refunds.executeSql(numSql,function(err,refund){
      if(err){
        logger.error(req.session.user[0].realname + "查询佣金返款列表，统计金额出错" + err);
      }
      req.body.page.rsm = refund&&refund[0].rsm?refund[0].rsm.toFixed(2):0;
      req.body.page.rrm = refund&&refund[0].rrm?refund[0].rrm.toFixed(2):0;
      req.body.page.sc = refund&&refund[0].sc?refund[0].sc.toFixed(2):0;
      req.body.page.totalCount = result;
      req.body.page.totalPage = Math.ceil(req.body.page.totalCount / req.body.page.limit);
      sql += " order by rbus.bill_date desc,rbus.sale_id desc limit " + req.body.page.start + "," + req.body.page.limit + "";
      refunds.executeSql(sql,function(err,result){
        if(err){
          logger.error(req.session.user[0].realname + "查询佣金返款列表" + err);
        }
        req.body.page.data = result;
        res.json({"code":"000000",message:req.body.page});
      });
    });
  });
});
//销售返款sql
function getQuerySql(req){
  //返款类型1：按销售返款 2：表示是采购（高打）返款 3：无返款
  var sh = "select sh.*,h.hospital_name from sales sh left join hospitals h on sh.hospital_id = h.hospital_id where sh.group_id = '"+req.session.user[0].group_id+"' and sh.sale_return_flag = '1' ";
  //返款记录需要手动修改的时候保存，所以，在查询所有返款时，要用销售记录，左连接返款记录
  sh = "select * from ("+sh+") sr left join refunds r on sr.sale_id = r.sales_id where 1=1";
  if(req.body.data.status){
    var s = req.body.data.status=="已返"?"r.refunds_real_time is not null && r.refunds_real_money is not null":"r.refunds_real_time is null && (r.refunds_real_money is null || r.refunds_real_money = '')";
    sh += " and "+s;
  }
  //连接查询返款账号
  sh = "select srb.*,b.account_number,b.account_person from ("+sh+") srb left join bank_account b on srb.receiver = b.account_id"
  //连接查询联系人
  var sql = "select s.*,d.product_type,d.contacts_name,d.product_business,d.product_return_explain,d.product_return_money,"+
            "d.product_return_discount,d.product_common_name,d.product_specifications,d.product_makesmakers,"+
            "d.product_unit,d.product_packing,d.product_mack_price,d.product_floor_price,d.product_high_discount"+
            " from ("+sh+") s left join (select dd.*,c.contacts_name from drugs dd left join contacts c on dd.contacts_id = c.contacts_id) d "+
            "on s.product_code = d.product_code where s.delete_flag = '0' and d.group_id = '"+req.session.user[0].group_id+"' ";
  if(req.body.data.productCommonName){
    sql += " and (d.product_common_name like '%"+req.body.data.productCommonName+"%' or d.product_name_pinyin like '%"+req.body.data.productCommonName+"%')";
  }
  if(req.body.data.product_code){
    sql += " and d.product_code = '"+req.body.data.product_code+"'"
  }
  if(req.body.data.contactId){
    sql += " and d.contacts_id = '"+req.body.data.contactId+"'"
  }
  if(req.body.data.refundser){
    //查询出与该返款人相关的所有联系人id
    var contactIdSql = "select cs.product_code from sales cs left join refunds cr on cs.sale_id = cr.sales_id where cs.group_id = '"+req.session.user[0].group_id+"' and cs.sale_return_flag = '1' ";
        contactIdSql += "and cr.refundser = '"+req.body.data.refundser+"'";
    contactIdSql = "select cdc.contacts_id from ("+contactIdSql+") csr left join "+
                   "(select cd.product_code,cc.contacts_id from drugs cd left join contacts cc on cd.contacts_id = cc.contacts_id) cdc "+
                   "on csr.product_code = cdc.product_code ";
    sql += " and d.contacts_id in ("+contactIdSql+")";
  }
  if(req.body.data.business){
    sql += " and d.product_business = '"+req.body.data.business+"'"
  }
  if(req.body.data.salesTime){
    var start = new Date(req.body.data.salesTime[0]).format("yyyy-MM-dd");
    var end = new Date(req.body.data.salesTime[1]).format("yyyy-MM-dd");
    sql += " and DATE_FORMAT(s.bill_date,'%Y-%m-%d') >= '"+start+"' and DATE_FORMAT(s.bill_date,'%Y-%m-%d') <= '"+end+"'";
  }
  if(req.body.data.returnTime){
    var start = new Date(req.body.data.returnTime[0]).format("yyyy-MM-dd");
    var end = new Date(req.body.data.returnTime[1]).format("yyyy-MM-dd");
    sql += " and (DATE_FORMAT(s.refunds_should_time,'%Y-%m-%d') >= '"+start+"' and DATE_FORMAT(s.refunds_should_time,'%Y-%m-%d') <= '"+end+"')";
  }
  //连接查询商业
  sql = "select rbus.*,bus.business_name from ("+sql+") rbus left join business bus on rbus.product_business = bus.business_id ";
  return sql;
}
//获取返款人
router.post("/getSalesRefunder",function(req,res){
  var refunds = DB.get("Refunds");
  //返款类型1：按销售返款 2：表示是采购（高打）返款 3：无返款
  var sql = "select r.refundser from sales s left join refunds r on s.sale_id = r.sales_id where s.group_id = '"+req.session.user[0].group_id+"' and s.sale_return_flag = '1' and s.delete_flag = '0' group by r.refundser";
  refunds.executeSql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "分组查询销售返款人" + err);
    }
    res.json({"code":"000000",message:result});
  });
});
//获取与某联系人相关的返款人
router.post("/getContactSalesRefunder",function(req,res){
  var refunds = DB.get("Refunds");
  //返款类型1：按销售返款 2：表示是采购（高打）返款 3：无返款
  var sql = "select r.refundser,s.product_code from sales s left join refunds r on s.sale_id = r.sales_id where s.group_id = '"+req.session.user[0].group_id+"' and s.sale_return_flag = '1' and s.delete_flag = '0' ";
      sql = "select sr.refundser from ("+sql+") sr left join "+
            "(select dd.product_code,c.contacts_name from drugs dd left join contacts c on dd.contacts_id = c.contacts_id) cdc "+
            "on sr.product_code = cdc.product_code  where sr.refundser != '' and cdc.contacts_name = '"+req.body.contact_name+"'";
  sql += " group by sr.refundser";
  refunds.executeSql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "查询某联系人想着的销售返款人" + err);
    }
    res.json({"code":"000000",message:result});
  });
});
//获取返款人
router.post("/getPurchasesRefunder",function(req,res){
  var refunds = DB.get("Refunds");
  //返款类型1：按销售返款 2：表示是采购（高打）返款 3：无返款
  var sql = "select r.refundser from purchase p left join refunds r on p.purchase_id = r.purchases_id where p.group_id = '"+req.session.user[0].group_id+"' and p.purchase_return_flag = '2' and p.delete_flag = '0' group by r.refundser";
  refunds.executeSql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "分组查询采购返款人" + err);
    }
    res.json({"code":"000000",message:result});
  });
});
//获取与某联系人相关的返款人
router.post("/getContactPurchasesRefunder",function(req,res){
  var refunds = DB.get("Refunds");
  //返款类型1：按销售返款 2：表示是采购（高打）返款 3：无返款
  var sql = "select r.refundser,p.drug_id from purchase p left join refunds r on p.purchase_id = r.purchases_id where p.group_id = '"+req.session.user[0].group_id+"' and p.purchase_return_flag = '2' and p.delete_flag = '0' ";
      sql = "select pr.refundser from ("+sql+") pr left join " +
            "(select cd.product_id,cc.contacts_name from drugs cd left join contacts cc on cd.contacts_id = cc.contacts_id) cdc "+
            "on pr.drug_id = cdc.product_id where pr.refundser != '' and cdc.contacts_name = '"+req.body.contact_name+"'";

  sql +=" group by pr.refundser";
  refunds.executeSql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "查询与联系人想关的采购返款人" + err);
    }
    res.json({"code":"000000",message:result});
  });
});
//获取联系人列表
router.post("/getAllContacts",function(req,res){
  var contacts = DB.get("Contacts");
  req.body.group_id = req.session.user[0].group_id;
  req.body.delete_flag = 0;
  contacts.where(req.body,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "返款管理，查询全部联系人出错" + err);
    }
    res.json({"code":"000000",message:result});
  });
});
module.exports = router;
