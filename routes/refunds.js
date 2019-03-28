var express = require("express");
var logger = require('../utils/logger');
var nodeExcel = require('excel-export');
var util= require('../utils/global_util.js');
var parse = require('csv-parse');
var XLSX = require("xlsx");
var uuid=require("node-uuid");
var router = express.Router();

//新增返款记录
router.post("/saveRefunds",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",45,") > 0 || req.session.user[0].authority_code.indexOf(",47,") > 0){
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
    req.body.refund_create_time = new Date();
    req.body.refund_create_userid = req.session.user[0].id;
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
    bankaccountdetail.account_detail_create_time = new Date();
    bankaccountdetail.account_detail_create_userid = req.session.user[0].id;
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
router.post("/deleteRefunds",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",103,") > 0 || req.session.user[0].authority_code.indexOf(",104,") > 0){
    var refunds = DB.get("Refunds");
    if(!req.body.refunds_id){//这个if里，更新用到，现在貌似没什么用。。。。。
      saveRefund={
        sales_id:req.body.sales_id,
        purchases_id:req.body.purchases_id,
        refund_delete_flag:"1",
      }
      refunds.insert(saveRefund,"refunds_id",function(err,result){
        if(err){
          logger.error(req.session.user[0].realname + "销售记录，新增返款记录，并标记为删除出错" + err);
        }
        res.json({"code":"000000",message:null});
      });
    }else{
      refunds.update(req.body,'refunds_id',function(err,result){
        if(err){
          logger.error(req.session.user[0].realname + "删除返款记录出错" + err);
        }
        var message = req.session.user[0].realname+"删除积分应收记录。id："+req.body.refunds_id;
        util.saveLogs(req.session.user[0].group_id,"-","-",message);
        res.json({"code":"000000",message:null});
      });
    }
  }else{
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
});
//编辑返款记录
router.post("/editRefunds",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",45,") > 0 || req.session.user[0].authority_code.indexOf(",47,") > 0){
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
    delete req.body.refund_create_time;
    var front_message = req.body.front_message;
    refunds.update(req.body,'refunds_id',function(err,result){
      if(err){
        logger.error(req.session.user[0].realname + "修改返款记录出错" + err);
      }
      var message = req.session.user[0].realname+"修改积分应收记录。";
      util.saveLogs(req.session.user[0].group_id,front_message,JSON.stringify(req.body),message);
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
//导出高打返款记录
router.post("/exportRefundPurchase",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",106,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var findParam = JSON.stringify(req.body);
  req.body.data = JSON.parse(findParam);
  var refunds = DB.get("Refunds");
  var sql = getPurchasesSql(req);
  sql += " order by p.time desc,p.purchase_create_time desc  ";
  refunds.executeSql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "导出高打返款记录出错" + err);
    }
    var conf ={};
    conf.stylesXmlFile = "./utils/styles.xml";
    conf.name = "mysheet";
    conf.cols = [{caption:'产品编码',type:'string'
    },{caption:'产品名称',type:'string'
    },{caption:'产品规格',type:'string'
    },{caption:'生产厂家',type:'string'
    },{caption:'单位',type:'string'
    },{caption:'包装',type:'string'
    },{caption:'中标价',type:'number'
    },{caption:'购入数量',type:'number'
    },{caption:'购入金额',type:'number'
    },{caption:'商业',type:'string'
    },{caption:'联系人',type:'string'
    },{
      caption:'打款日期',type:'string',
      beforeCellWrite:function(row, cellData){
        if(cellData){
          return new Date(cellData).format("yyyy-MM-dd");
        }else{
          return "";
        }
      }
    },{
      caption:'发货日期',type:'string',
      beforeCellWrite:function(row, cellData){
        if(cellData){
          return new Date(cellData).format("yyyy-MM-dd");
        }else{
          return "";
        }
      }
    },{
      caption:'应返日期',type:'string',
      beforeCellWrite:function(row, cellData){
        if(cellData){
          return new Date(cellData).format("yyyy-MM-dd");
        }else{
          return "";
        }
      }
    },{caption:'积分',type:'number'
    },{caption:'应返积分',type:'number'
    },{
      caption:'实返日期',type:'string',
      beforeCellWrite:function(row, cellData){
        if(cellData){
          return new Date(cellData).format("yyyy-MM-dd");
        }else{
          return "";
        }
      }
    },{caption:'实返积分',type:'number'
    },{caption:'返积分人',type:'string'
    },{caption:'收积分账号',type:'string'
    },{caption:'备注',type:'string'
    }];
    var header = ['product_code', 'product_common_name', 'product_specifications',
                  'product_makesmakers','product_unit','product_packing','purchase_price','purchase_number',
                  'purchase_money','business_name','contacts_name','make_money_time','send_out_time','refunds_should_time',
                  'product_return_money','refunds_should_money','refunds_real_time','refunds_real_money','refundser',
                  'account_number','refunds_remark'];
    conf.rows = util.formatExcel(header,result);
    var result = nodeExcel.execute(conf);
    var message = req.session.user[0].realname+"导出采进应收记录。导出"+conf.rows.length+"条。";
    util.saveLogs(req.session.user[0].group_id,"-",findParam,message);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats');
    res.setHeader("Content-Disposition", "attachment; filename=" + "Report.xlsx");
    res.end(result, 'binary');
  });
});
//获取高打返款列表
router.post("/getPurchaseRefunds",function(req,res){
  var noDate = new Date();
  if(req.session.user[0].authority_code.indexOf(",44,") < 0){
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
      req.body.page.rsm = refund&&refund[0].rsm?Math.round(refund[0].rsm*100)/100:0;
      req.body.page.rrm = refund&&refund[0].rrm?Math.round(refund[0].rrm*100)/100:0;
      req.body.page.sc = refund&&refund[0].sc?Math.round(refund[0].sc*100)/100:0;
      req.body.page.totalCount = result;
      req.body.page.totalPage = Math.ceil(req.body.page.totalCount / req.body.page.limit);
      sql += " order by p.time desc,p.purchase_create_time desc limit " + req.body.page.start + "," + req.body.page.limit + "";
      refunds.executeSql(sql,function(err,result){
        if(err){
          logger.error(req.session.user[0].realname + "查询高打返款列表" + err);
        }
        req.body.page.data = result;
        logger.error(req.session.user[0].realname + "refunds-getPurchaseRefunds运行时长" + (noDate.getTime()-new Date().getTime()));
        res.json({"code":"000000",message:req.body.page});
      });
    });
  });
});
//采购返款sql
function getPurchasesSql(req){
  //返款记录需要手动修改的时候保存，所以，在查询所有返款时，要用采购记录，左连接返款记录
  //返款类型1：按销售返款 2：表示是采购（高打）返款 3：无返款
 var sql = "select p.purchase_id,p.purchase_price,p.purchase_number,p.batch_number,p.purchase_money,p.time,p.make_money_time,p.send_out_time,"+
           "b.account_number,b.account_person,c.contacts_name,bus.business_name,r.refunds_should_time,r.refunds_should_money,"+
           "p.purchase_mack_price,r.refunds_id,r.refunds_real_time,r.refunds_real_money,r.service_charge,r.refundser,r.refunds_remark,r.receiver,"+
           "d.product_code,d.product_business,d.product_floor_price,d.product_high_discount,d.product_return_explain,"+
           "d.product_type,d.product_return_money,d.product_return_discount,d.product_common_name,d.product_specifications,"+
           "d.product_supplier,d.product_makesmakers,d.product_unit,d.product_packing "+//药品属性
           "from purchase p "+
           "left join refunds r on p.purchase_id = r.purchases_id "+
           "left join purchase_recovery pr on r.purchases_id = pr.purchaserecovery_purchase_id "+
           "left join bank_account b on r.receiver = b.account_id "+
           "left join drugs d on p.drug_id = d.product_id ";
var tagSql = "select tagd.drug_id,concat(GROUP_CONCAT(tagd.tag_id),',') tag_ids from tag_drug tagd "+
           "where tagd.tag_drug_deleta_flag = '0' and tagd.tag_drug_group_id = '"+req.session.user[0].group_id+"' group by tagd.drug_id ";
     sql+= "left join ("+tagSql+") td on d.product_id = td.drug_id "+
           "left join contacts c on d.contacts_id = c.contacts_id "+
           "left join business bus on d.product_business = bus.business_id "+
           "where p.group_id = '"+req.session.user[0].group_id+"' and p.purchase_return_flag='2' and p.make_money_time is not null and p.delete_flag = '0' "+
           "and r.refund_delete_flag = '0' and d.group_id = '"+req.session.user[0].group_id+"'  and d.delete_flag = '0' ";
  //数据权限
  if(req.session.user[0].data_authority == "2"){
    sql += " and p.purchase_create_userid = '"+req.session.user[0].id+"' ";
  }
  if(req.body.data.tag && req.body.data.tag != 'undefined'){
    sql += "and td.tag_ids like '%"+req.body.data.tag+",%'"
  }
  if(req.body.data.batch_number){
    sql += "and p.batch_number = '"+req.body.data.batch_number+"'";
  }
  if(req.body.data.overdue){
    req.body.data.status="未返";
  }
  if(req.body.data.status){
    var s = req.body.data.status=="已返"?"r.refunds_real_time is not null && r.refunds_real_money is not null":"r.refunds_real_time is null && (r.refunds_real_money is null || r.refunds_real_money = '')";
    sql += " and "+s;
  }
  if(req.body.data.returnTime){
    var start = new Date(req.body.data.returnTime[0]).format("yyyy-MM-dd");
    var end = new Date(req.body.data.returnTime[1]).format("yyyy-MM-dd");
    sql += " and (DATE_FORMAT(r.refunds_should_time,'%Y-%m-%d') >= '"+start+"' and DATE_FORMAT(r.refunds_should_time,'%Y-%m-%d') <= '"+end+"')";
  }
  if(req.body.data.realReturnTime){
    var start = new Date(req.body.data.realReturnTime[0]).format("yyyy-MM-dd");
    var end = new Date(req.body.data.realReturnTime[1]).format("yyyy-MM-dd");
    sql += " and (DATE_FORMAT(r.refunds_real_time,'%Y-%m-%d') >= '"+start+"' and DATE_FORMAT(r.refunds_real_time,'%Y-%m-%d') <= '"+end+"')";
  }
  if(req.body.data.makeMoneyTime){
    var start = new Date(req.body.data.makeMoneyTime[0]).format("yyyy-MM-dd");
    var end = new Date(req.body.data.makeMoneyTime[1]).format("yyyy-MM-dd");
    sql += " and (DATE_FORMAT(p.make_money_time,'%Y-%m-%d') >= '"+start+"' and DATE_FORMAT(p.make_money_time,'%Y-%m-%d') <= '"+end+"')";
  }
  if(req.body.data.overdue){//查询逾期未返款
    var nowDate = new Date().format("yyyy-MM-dd");
    sql += " and DATE_FORMAT(r.refunds_should_time,'%Y-%m-%d') <= '"+nowDate+"'";
  }
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
                   "on csr.drug_id = cdc.product_id where d.contacts_id = cdc.contacts_id";
    sql += " and exists("+contactIdSql+")";
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
  return sql;
}
//导出佣金返款记录
router.post("/exportRefundSale",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",106,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var findParam = JSON.stringify(req.body);
  req.body.data = JSON.parse(findParam);
  var refunds = DB.get("Refunds");
  var sql = getQuerySql(req);
  sql += " order by s.bill_date desc,s.sale_create_time desc ";
  refunds.executeSql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "导出高打返款记录出错" + err);
    }
    var conf ={};
    conf.stylesXmlFile = "./utils/styles.xml";
    conf.name = "mysheet";
    conf.cols = [{caption:'产品编码',type:'string'
    },{caption:'产品名称',type:'string'
    },{caption:'产品规格',type:'string'
    },{caption:'生产厂家',type:'string'
    },{caption:'单位',type:'string'
    },{caption:'包装',type:'string'
    },{caption:'中标价',type:'number'
    },{caption:'销售数量',type:'number'
    },{caption:'销售金额',type:'number'
    },{caption:'商业',type:'string'
    },{caption:'联系人',type:'string'
    },{caption:'销往单位',type:'string'
    },{
      caption:'销售日期',type:'string',
      beforeCellWrite:function(row, cellData){
        if(cellData){
          return new Date(cellData).format("yyyy-MM-dd");
        }else{
          return "";
        }
      }
    },{
      caption:'应返日期',type:'string',
      beforeCellWrite:function(row, cellData){
        if(cellData){
          return new Date(cellData).format("yyyy-MM-dd");
        }else{
          return "";
        }
      }
    },{caption:'积分',type:'number'
    },{caption:'特殊积分',type:'number'
    },{caption:'应返积分',type:'number'
    },{
      caption:'实返日期',type:'string',
      beforeCellWrite:function(row, cellData){
        if(cellData){
          return new Date(cellData).format("yyyy-MM-dd");
        }else{
          return "";
        }
      }
    },{caption:'实返积分',type:'number'
    },{caption:'返积分人',type:'string'
    },{caption:'收积分账号',type:'string'
    },{caption:'备注',type:'string'
    }];
    var header = ['product_code', 'product_common_name', 'product_specifications',
                  'product_makesmakers','product_unit','product_packing','sale_price','sale_num',
                  'sale_money','business_name','contacts_name','hospital_name','bill_date','refunds_should_time',
                  'product_return_money','hospital_policy_return_money','refunds_should_money','refunds_real_time','refunds_real_money','refundser',
                  'account_number','refunds_remark'];
    conf.rows = util.formatExcel(header,result);
    var result = nodeExcel.execute(conf);
    var message = req.session.user[0].realname+"导出销售应收记录。导出"+conf.rows.length+"条。";
    util.saveLogs(req.session.user[0].group_id,"-",findParam,message);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats');
    res.setHeader("Content-Disposition", "attachment; filename=" + "Report.xlsx");
    res.end(result, 'binary');
  });
});
//获取返款
router.post("/getSaleRefunds",function(req,res){
  var noDate = new Date();
  if(req.session.user[0].authority_code.indexOf(",46,") < 0){
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
      req.body.page.rsm = refund&&refund[0].rsm?Math.round(refund[0].rsm*100)/100:0;
      req.body.page.rrm = refund&&refund[0].rrm?Math.round(refund[0].rrm*100)/100:0;
      req.body.page.sc = refund&&refund[0].sc?Math.round(refund[0].sc*100)/100:0;
      req.body.page.totalCount = result;
      req.body.page.totalPage = Math.ceil(req.body.page.totalCount / req.body.page.limit);
      sql += " order by s.bill_date desc,s.sale_create_time desc limit " + req.body.page.start + "," + req.body.page.limit + "";
      refunds.executeSql(sql,function(err,result){
        if(err){
          logger.error(req.session.user[0].realname + "查询佣金返款列表" + err);
        }
        req.body.page.data = result;
        logger.error(req.session.user[0].realname + "refunds-getSaleRefunds运行时长" + (noDate.getTime()-new Date().getTime()));
        res.json({"code":"000000",message:req.body.page});
      });
    });
  });
});
//销售返款sql
function getQuerySql(req){
  //返款类型1：按销售返款 2：表示是采购（高打）返款 3：无返款
  //返款记录需要手动修改的时候保存，所以，在查询所有返款时，要用销售记录，左连接返款记录
  var sql = "select s.sale_id,s.sale_price,s.sale_num,s.sale_money,s.bill_date,r.refunds_id,r.refunds_should_time,r.refunds_should_money,"+
            "r.refunds_real_time,r.refunds_real_money,r.service_charge,r.refundser,r.receiver,r.refunds_remark,bus.business_name,"+
            "h.hospital_name,b.account_number,b.account_person,c.contacts_name,d.product_type,"+
            "d.product_business,d.product_return_explain,d.product_return_money,d.product_code,"+
            "d.product_return_discount,d.product_common_name,d.product_specifications,d.product_makesmakers,"+
            "d.product_unit,d.product_packing,d.product_mack_price,d.product_floor_price,d.product_high_discount,hpr.hospital_policy_return_money "+
            "from sales s "+
            "left join refunds r on s.sale_id = r.sales_id "+
            "left join drugs d on s.product_code = d.product_code ";
var tagSql = "select tagd.drug_id,concat(GROUP_CONCAT(tagd.tag_id),',') tag_ids from tag_drug tagd "+
            "where tagd.tag_drug_deleta_flag = '0' and tagd.tag_drug_group_id = '"+req.session.user[0].group_id+"' group by tagd.drug_id ";
      sql+= "left join ("+tagSql+") td on d.product_id = td.drug_id "+
            "left join bank_account b on r.receiver = b.account_id "+
            "left join hospitals h on s.hospital_id = h.hospital_id "+
            "left join contacts c on d.contacts_id = c.contacts_id "+
            "left join business bus on d.product_business = bus.business_id "+
            "left join hospital_policy_record hpr on s.hospital_id = hpr.hospital_policy_hospital_id and d.product_id = hpr.hospital_policy_drug_id and hpr.hospital_policy_delete_flag !='1' "+
            "where s.group_id = '"+req.session.user[0].group_id+"' and s.sale_return_flag = '1' and s.delete_flag = '0' "+
            "and (r.refund_delete_flag = '0' or r.refund_delete_flag is null) and d.group_id = '"+req.session.user[0].group_id+"' and d.delete_flag = '0'";
  if(req.body.data.overdue){
    req.body.data.status="未返";
  }
  if(req.body.data.tag && req.body.data.tag != 'undefined'){
    sql += "and td.tag_ids like '%"+req.body.data.tag+",%'"
  }
  if(req.body.data.hospitalsId){
    sql += " and s.hospital_id = '"+req.body.data.hospitalsId+"' ";
  }
  if(req.body.data.status){
    var s = req.body.data.status=="已返"?"r.refunds_real_time is not null && r.refunds_real_money is not null":"r.refunds_real_time is null && (r.refunds_real_money is null || r.refunds_real_money = '')";
    sql += " and "+s;
  }
  //数据权限
  if(req.session.user[0].data_authority == "2"){
    sql += " and s.sale_create_userid = '"+req.session.user[0].id+"' ";
  }
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
                   "on csr.product_code = cdc.product_code where d.contacts_id = cdc.contacts_id";
    sql += " and exists("+contactIdSql+")";
  }
  if(req.body.data.business){
    sql += " and d.product_business = '"+req.body.data.business+"'"
  }
  if(req.body.data.salesTime){
    var start = new Date(req.body.data.salesTime[0]).format("yyyy-MM-dd");
    var end = new Date(req.body.data.salesTime[1]).format("yyyy-MM-dd");
    sql += " and DATE_FORMAT(s.bill_date,'%Y-%m-%d') >= '"+start+"' and DATE_FORMAT(s.bill_date,'%Y-%m-%d') <= '"+end+"'";
  }
  if(req.body.data.realReturnTime){
    var start = new Date(req.body.data.realReturnTime[0]).format("yyyy-MM-dd");
    var end = new Date(req.body.data.realReturnTime[1]).format("yyyy-MM-dd");
    sql += " and (DATE_FORMAT(r.refunds_real_time,'%Y-%m-%d') >= '"+start+"' and DATE_FORMAT(r.refunds_real_time,'%Y-%m-%d') <= '"+end+"')";
  }
  if(req.body.data.returnTime){
    var start = new Date(req.body.data.returnTime[0]).format("yyyy-MM-dd");
    var end = new Date(req.body.data.returnTime[1]).format("yyyy-MM-dd");
    sql += " and (DATE_FORMAT(r.refunds_should_time,'%Y-%m-%d') >= '"+start+"' and DATE_FORMAT(r.refunds_should_time,'%Y-%m-%d') <= '"+end+"')";
  }
  if(req.body.data.overdue){//查询逾期未返款
    var nowDate = new Date().format("yyyy-MM-dd");
    sql += " and DATE_FORMAT(r.refunds_should_time,'%Y-%m-%d') <= '"+nowDate+"'";
  }
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
