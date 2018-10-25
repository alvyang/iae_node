var express = require("express");
var nodeExcel = require('excel-export');
var logger = require('../utils/logger');
var fs = require('fs');
var util= require('../utils/global_util.js');
var router = express.Router();


//查询药品商业对应的政策
router.post("/selesPolicy",function(req,res){
  var sql = "select * from sale_policy sp where sp.sale_hospital_id = '"+req.body.hospital_id+"' and sp.sale_drug_id = '"+req.body.product_id+"'";
  var salePolicy = DB.get("SalePolicy");
  salePolicy.executeSql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "查询销售医院药品政策，出错" + err);
    }
    res.json({"code":"000000",message:result});
  });
});
//导出回款记录
router.post("/exportSalesRefund",function(req,res){
  if(req.session.user[0].authority_code.indexOf("e430d5a0-d802-11e8-a19c-cf0f6be47d2e") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  req.body.data = req.body;
  var sales = DB.get("Sales");
  var sql = getQuerySql(req);
  sql += " order by shbp.bill_date desc,shbp.hospital_id asc,shbp.sale_create_time asc";
  sales.executeSql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "导出销售记录出错" + err);
    }
    var conf ={};
    conf.stylesXmlFile = "./utils/styles.xml";
    conf.name = "mysheet";
    conf.cols = [{
        caption:'日期',
        type:'string',
        beforeCellWrite:function(row, cellData){
          return new Date(cellData).format('yyyy-MM-dd');
        }
    },{caption:'销往单位',type:'string'
    },{caption:'产品编码',type:'string'
    },{caption:'产品名称',type:'string'
    },{caption:'产品规格',type:'string'
    },{caption:'生产厂家',type:'string'
    },{caption:'单位',type:'string'
    },{caption:'计划数量',type:'number'
    },{caption:'中标价',type:'number'
    },{caption:'购入金额',type:'number'
    },{caption:'回款金额',type:'number'
    },{caption:'回款总额',type:'number'
    },{
        caption:'回款时间',
        type:'string',
        beforeCellWrite:function(row, cellData){
          if(cellData){
            return new Date(cellData).format('yyyy-MM-dd');
          }else{
            return "";
          }

        }
    },{caption:'回款备注',type:'string'
    }];
    var header = ['bill_date', 'hospital_name', 'product_code', 'product_common_name', 'product_specifications',
                  'product_makesmakers','product_unit','sale_num','sale_price','sale_money','sale_return_price',
                  'sale_return_money','sale_return_time','sale_policy_remark'];
    conf.rows = util.formatExcel(header,result);
    var result = nodeExcel.execute(conf);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats');
    res.setHeader("Content-Disposition", "attachment; filename=" + "Report.xlsx");
    res.end(result, 'binary');
  });
});
//导出销售记录
router.post("/exportSales",function(req,res){
  if(req.session.user[0].authority_code.indexOf("52") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  req.body.data = req.body;
  var sales = DB.get("Sales");
  var sql = getQuerySql(req);
  sql += " order by shbp.bill_date desc,shbp.hospital_id asc,shbp.sale_create_time asc";
  sales.executeSql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "导出销售记录出错" + err);
    }
    var conf ={};
    conf.stylesXmlFile = "./utils/styles.xml";
    conf.name = "mysheet";
    conf.cols = [{
        caption:'日期',
        type:'string',
        beforeCellWrite:function(row, cellData){
          return new Date(cellData).format('yyyy-MM-dd');
        }
    },{caption:'销售机构',type:'string'
    },{caption:'产品编码',type:'string'
    },{caption:'产品名称',type:'string'
    },{caption:'产品规格',type:'string'
    },{caption:'生产厂家',type:'string'
    },{caption:'单位',type:'string'
    },{caption:'计划数量',type:'number'
    },{caption:'中标价',type:'number'
    },{caption:'购入金额',type:'number'
    }];
    var header = ['bill_date', 'hospital_name', 'product_code', 'product_common_name', 'product_specifications','product_makesmakers','product_unit','sale_num','sale_price','sale_money'];
    conf.rows = util.formatExcel(header,result);
    var result = nodeExcel.execute(conf);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats');
    res.setHeader("Content-Disposition", "attachment; filename=" + "Report.xlsx");
    res.end(result, 'binary');
  });
});

router.post("/getAllSales",function(req,res){
  var sales = DB.get("Sales");
  var sql = getQuerySql(req);
  sales.executeSql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "查询所有销售记录出错" + err);
    }
    res.json({"code":"000000",message:result});
  });
});
//新增销售
router.post("/saveSales",function(req,res){
  if(req.session.user[0].authority_code.indexOf("48") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var sales = DB.get("Sales");
  req.body.group_id = req.session.user[0].group_id;
  req.body.bill_date = new Date(req.body.bill_date).format('yyyy-MM-dd');
  var productType = req.body.product_type;
  var stock = req.body.stock;
  var productId = req.body.product_id;
  var productReturnMoney = req.body.product_return_money;
  delete req.body.product_type;
  delete req.body.stock;
  delete req.body.product_id;
  req.body.sale_create_time = new Date();
  req.body.sale_create_userid = req.session.user[0].id;
  sales.insert(req.body,'sale_id',function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "新增销售记录出错" + err);
    }
    //新增流水   新增返款记录
    saveAllotAccountDetail(req,result);
    if(productType == '佣金'){
      saveRefundsSale(req,productReturnMoney,result);
    }
    res.json({"code":"000000",message:result});
  });

  //添加完销售记录后，更新库存。
  if(productType == '高打'){
    var drugsStock = {
      product_id:productId,
      stock:stock-req.body.sale_num
    }
    var drugs = DB.get("Drugs");
    drugs.update(drugsStock,'product_id',function(err,result){
      if(err){
        logger.error(req.session.user[0].realname + "新增销售记录，更新库存出错" + err);
      }
    });
  }
});
//新增 返款记录
function saveRefundsSale(req,productReturnMoney,id){
  //新增返款记录  并保存应返金额
  var m = {
    refund_create_time:new Date(),
    refund_create_userid:req.session.user[0].id,
    sales_id:id,
  }
  if(productReturnMoney){
    m.refunds_should_money = util.mul(productReturnMoney,req.body.sale_num,2);
  }
  var refunds = DB.get("Refunds");
  refunds.insert(m,'refunds_id',function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "销售记录，新增返款记录出错" + err);
    }
  });
}
//插入一条流水账记录
function saveAllotAccountDetail(req,id){
  //添加一条流水账医院回款记录，标记为删除状态
  var bankaccountdetail={};
  bankaccountdetail.account_detail_deleta_flag = '1';
  bankaccountdetail.account_detail_group_id = req.session.user[0].group_id;
  bankaccountdetail.flag_id = "sale_hospital_"+id;
  bankaccountdetail.account_detail_create_time = new Date();
  bankaccountdetail.account_detail_create_userid = req.session.user[0].id;
  var accountDetail = DB.get("AccountDetail");
  accountDetail.insert(bankaccountdetail,'account_detail_id',function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "销售医院返款,添加返款新增流水出错" + err);
    }
  });
}
//编辑销售记录
router.post("/editSales",function(req,res){
  if(req.session.user[0].authority_code.indexOf("49") > 0 || req.session.user[0].authority_code.indexOf("4a023420-d40a-11e8-bfbc-6f9a2209108b") > 0){
    var sales = DB.get("Sales");
    req.body.bill_date = new Date(req.body.bill_date).format('yyyy-MM-dd');
    var params = {
      sale_id:req.body.sale_id,
  		sale_money:req.body.sale_money,
  		sale_num:req.body.sale_num,
  		gross_profit:req.body.gross_profit,
  		real_gross_profit:req.body.real_gross_profit,
  		accounting_cost:req.body.accounting_cost,
  		cost_univalent:req.body.cost_univalent,
  		delete_flag:req.body.delete_flag,
  	  group_id:req.body.group_id,
  		bill_date:req.body.bill_date,
  		hospital_id:req.body.hospital_id,
      sale_account_id:req.body.sale_account_id,
      sale_return_money:req.body.sale_return_money,
      sale_return_price:req.body.sale_return_price,
      sale_contact_id:req.body.sale_contact_id
    }
    if(req.body.sale_return_time){
      params.sale_return_time = new Date(req.body.sale_return_time).format('yyyy-MM-dd');
    }
    sales.update(params,'sale_id',function(err,result){
      if(err){
        logger.error(req.session.user[0].realname + "修改销售出错" + err);
      }
      //销售回款时，更新政策
      updateSalePolicy(req);
      //更新返款金额
      updateRefundsSale(req);
      updateAllotAccountDetail(req);
      res.json({"code":"000000",message:null});
    });

    //添加完销售记录后，更新库存。
    if(req.body.product_type == '高打'){
      var drugsStock = {
        product_id:req.body.product_id,
        stock:req.body.stock-req.body.sale_num + parseInt(req.body.sale_num_temp)
      }
      var drugs = DB.get("Drugs");
      drugs.update(drugsStock,'product_id',function(err,result){
        if(err){
          logger.error(req.session.user[0].realname + "修改销售记录，更新库存出错" + err);
        }
      });
    }
  }else{
    res.json({"code":"111112",message:"无权限"});
  }
});
//更新返款金额
function updateRefundsSale(req){
  //新增返款记录  并保存应返金额
  var m = {
    sales_id:req.body.sale_id,
  }
  if(req.body.product_return_money){
    m.refunds_should_money = util.mul(req.body.product_return_money,req.body.sale_num,2);
  }
  var refunds = DB.get("Refunds");
  refunds.update(m,'sales_id',function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "修改销售记录，修改返款记录出错" + err);
    }
  });
}
//更新调货医院--药品 政策信息
function updateSalePolicy(req){
  var salePolicy = DB.get("SalePolicy");
  var sql = "insert into sale_policy(sale_hospital_id,sale_drug_id,sale_policy_money,sale_policy_remark,sale_policy_contact_id";
      sql+=") values ('"+req.body.hospital_id+"','"+req.body.product_id+"','"+req.body.sale_return_price+"','"+req.body.sale_policy_remark+"','"+req.body.sale_contact_id+"'";
      sql +=") ON DUPLICATE KEY UPDATE sale_policy_money=VALUES(sale_policy_money),sale_policy_remark=VALUES(sale_policy_remark),sale_policy_contact_id=VALUES(sale_policy_contact_id)";
  salePolicy.executeSql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "更新销售医院药品政策，出错" + err);
    }
  });
}
//添加调货，并直接返款，则添加流水账信息
function updateAllotAccountDetail(req){
  var bankaccountdetail={};
  if(req.body.sale_account_id){
    bankaccountdetail.account_detail_deleta_flag = '0';
    bankaccountdetail.account_id = req.body.sale_account_id;
  }
  bankaccountdetail.account_detail_money = -req.body.sale_return_money;
  if(req.body.sale_return_time){
    bankaccountdetail.account_detail_time = new Date(req.body.sale_return_time).format('yyyy-MM-dd');
  }
  bankaccountdetail.account_detail_mark = bankaccountdetail.account_detail_time+req.body.hospital_name+"销售"+
                                          req.body.product_common_name+"回款"+req.body.sale_return_money;
  bankaccountdetail.account_detail_group_id = req.session.user[0].group_id;
  bankaccountdetail.flag_id = "sale_hospital_"+req.body.sale_id;
  bankaccountdetail.account_detail_create_time = new Date();
  bankaccountdetail.account_detail_create_userid = req.session.user[0].id;
  var accountDetail = DB.get("AccountDetail");
  accountDetail.update(bankaccountdetail,'flag_id',function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "修改返款修改流水出错" + err);
    }
  });
}
//删除联系人
router.post("/deleteSales",function(req,res){
  if(req.session.user[0].authority_code.indexOf("50") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var sales = DB.get("Sales");
  req.body.delete_flag = 1;
  var productType = req.body.product_type;
  var stock = parseInt(req.body.stock);
  var productId = req.body.product_id;
  var saleNum = parseInt(req.body.sale_num);
  delete req.body.product_type;
  delete req.body.stock;
  delete req.body.product_id;
  delete req.body.sale_num;
  sales.update(req.body,'sale_id',function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "删除销售出错" + err);
    }
    res.json({"code":"000000",message:null});
  });

  //删除完销售记录后，更新库存。
  if(productType == '高打'){
    var drugsStock = {
      product_id:productId,
      stock:stock+saleNum
    }
    var drugs = DB.get("Drugs");
    drugs.update(drugsStock,'product_id',function(err,result){
      if(err){
        logger.error(req.session.user[0].realname + "删除销售记录，更新库存出错" + err);
      }
    });
  }
});
//查询销售记录
router.post("/getSales",function(req,res){
  if(req.session.user[0].authority_code.indexOf("51") > 0 || req.session.user[0].authority_code.indexOf("47979cc0-d40a-11e8-bfbc-6f9a2209108b") > 0){
    var sales = DB.get("Sales");
    var sql = getQuerySql(req);
    sales.countBySql(sql,function(err,result){
      if(err){
        logger.error(req.session.user[0].realname + "查询销售记录，统计总数出错" + err);
      }
      var numSql = "select sum(num.sale_money) as saleMoney,sum(num.real_gross_profit) as realGrossProfit,sum(num.gross_profit) as grossProfit,sum(num.sale_return_money) as saleReturnMoney from ( " + sql + " ) num";
      sales.executeSql(numSql,function(err,money){
        if(err){
          logger.error(req.session.user[0].realname + "查询销售记录，统计金额出错" + err);
        }
        req.body.page.totalCount = result;
        req.body.page.saleMoney = money && money[0].saleMoney?money[0].saleMoney.toFixed(2):0;
        req.body.page.realGrossProfit = money && money[0].realGrossProfit?money[0].realGrossProfit.toFixed(2):0;
        req.body.page.grossProfit = money && money[0].grossProfit?money[0].grossProfit.toFixed(2):0;
        req.body.page.saleReturnMoney = money && money[0].saleReturnMoney?money[0].saleReturnMoney.toFixed(2):0;
        req.body.page.totalPage = Math.ceil(req.body.page.totalCount / req.body.page.limit);
        sql += " order by shbp.bill_date desc,shbp.sale_create_time desc limit " + req.body.page.start + "," + req.body.page.limit + "";
        sales.executeSql(sql,function(err,result){
          if(err){
            logger.error(req.session.user[0].realname + "查询销售记录" + err);
          }
          req.body.page.data = result;
          res.json({"code":"000000",message:req.body.page});
        });
      });
    });
  }else{
    res.json({"code":"111112",message:"无权限"});
  }
});
function getQuerySql(req){
  //连接查询医院名称
  var sh = "select sh.*,h.hospital_name from sales sh left join hospitals h on sh.hospital_id = h.hospital_id where sh.delete_flag = '0' and sh.group_id = '"+req.session.user[0].group_id+"' ";
  //连接查询药品信息
  var sql = "select s.*,d.product_id,d.stock,d.product_type,d.buyer,d.product_business,d.product_common_name,d.product_specifications,"+
            "d.product_makesmakers,d.product_unit,d.product_packing,d.product_return_money"+
            " from ("+sh+") s left join drugs d on s.product_code = d.product_code where d.delete_flag = '0' and d.group_id = '"+req.session.user[0].group_id+"' ";

  //数据权限
  if(req.session.user[0].data_authority == "2"){
    sql += "and s.sale_create_userid = '"+req.session.user[0].id+"'";
  }
  if(req.body.data.productCommonName){
    sql += " and (d.product_common_name like '%"+req.body.data.productCommonName+"%' or d.product_name_pinyin like '%"+req.body.data.productCommonName+"%')";
  }
  if(req.body.data.product_code){
    sql += " and d.product_code = '"+req.body.data.product_code+"'"
  }
  if(req.body.data.productType){
    var type = req.body.data.productType;
    if(typeof type == 'object'){
      var t = type.join(",").replace(/,/g,"','");
      sql += " and d.product_type in ('"+t+"')"
    }else{
      sql += " and d.product_type in ('"+type+"')"
    }
  }
  if(req.body.data.hospitalsId){
    sql += " and s.hospital_id = '"+req.body.data.hospitalsId+"'"
  }
  if(req.body.data.business){
    sql += " and d.product_business = '"+req.body.data.business+"'"
  }
  if(req.body.data.sale_type){
    sql += " and s.sale_type = '"+req.body.data.sale_type+"'"
  }
  if(req.body.data.contactId){
    sql += " and d.contacts_id = '"+req.body.data.contactId+"'"
  }
  if(req.body.data.sale_contact_id){
    sql += " and s.sale_contact_id = '"+req.body.data.sale_contact_id+"'"
  }
  if(req.body.data.salesTime){
    var start = new Date(req.body.data.salesTime[0]).format("yyyy-MM-dd");
    var end = new Date(req.body.data.salesTime[1]).format("yyyy-MM-dd");
    sql += " and DATE_FORMAT(s.bill_date,'%Y-%m-%d') >= '"+start+"' and DATE_FORMAT(s.bill_date,'%Y-%m-%d') <= '"+end+"'";
  }
  if(req.body.data.rate_gap && req.body.data.rate_gap!=0){
    sql += " and (s.sale_price-s.accounting_cost)*100/s.sale_price  "+req.body.data.rate_formula+" "+req.body.data.rate_gap+" "
  }
  //连接查询标签
  var tagSql = "select td.drug_id,concat(GROUP_CONCAT(td.tag_id),',') tag_ids from tag_drug td "+
               "where td.tag_drug_deleta_flag = '0' and td.tag_drug_group_id = '"+req.session.user[0].group_id+"' "+
               "group by td.drug_id ";
  sql = "select sbust.* from ("+sql+") sbust left join ("+tagSql+") tag on sbust.product_id = tag.drug_id ";
  if(req.body.data.tag){
     sql += "where tag.tag_ids like '%"+req.body.data.tag+",%'";
  }


  if(req.body.data.salesReturnFlag){
    //连接查询商业名称
    sql = "select shbus.*,bus.business_name from ("+sql+") shbus left join business bus on shbus.product_business = bus.business_id ";
    //连接查询医院药品政策表
    sql = "select * from ("+sql+") shbp left join sale_policy sp on shbp.hospital_id = sp.sale_hospital_id and shbp.product_id = sp.sale_drug_id "+
          "where sp.sale_policy_money is not null and sp.sale_policy_money !=''";
  }else{
    //连接查询商业名称
    sql = "select shbp.*,bus.business_name from ("+sql+") shbp left join business bus on shbp.product_business = bus.business_id ";
  }
  return sql;
}
//获取联系人列表
router.post("/getAllContacts",function(req,res){
  var contacts = DB.get("Contacts");
  req.body.group_id = req.session.user[0].group_id;
  req.body.delete_flag = 0;
  contacts.where(req.body,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "销售管理，查询全部联系人" + err);
    }
    res.json({"code":"000000",message:result});
  });
});
module.exports = router;
