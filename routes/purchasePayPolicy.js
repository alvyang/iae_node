var express = require("express");
var pinyin = require("node-pinyin");
var nodeExcel = require('excel-export');
var logger = require('../utils/logger');
var util= require('../utils/global_util.js');
var parse = require('csv-parse');
var XLSX = require("xlsx");
var router = express.Router();

//销售付款，更新返款状态
router.post("/editSalesPay",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",49,") > 0 || req.session.user[0].authority_code.indexOf(",128,") > 0){
    var sales = DB.get("Sales");
    req.body.bill_date = new Date(req.body.bill_date).format('yyyy-MM-dd');
    var params = {
      sale_id:req.body.sale_id,
  		sale_money:req.body.sale_money,
      sale_price:req.body.sale_price,
  		sale_num:req.body.sale_num,
  		gross_profit:req.body.gross_profit,
  		real_gross_profit:req.body.real_gross_profit,
  		accounting_cost:req.body.accounting_cost,
  		cost_univalent:req.body.cost_univalent,
  		bill_date:req.body.bill_date,
  		hospital_id:req.body.hospital_id,
      sale_account_id:req.body.sale_account_id,
      sale_return_price:req.body.sale_return_price,
      sale_contact_id:req.body.sale_contact_id,
      sale_type:req.body.sale_type,
      sale_account_name:req.body.sale_account_name,
      sale_account_number:req.body.sale_account_number,
      sale_account_address:req.body.sale_account_address,
      batch_number:req.body.batch_number,
      sale_other_money:req.body.sale_other_money,
      sale_return_real_return_money:req.body.sale_return_real_return_money
    }
    params.sale_return_money = req.body.sale_return_money?req.body.sale_return_money:util.mul(req.body.sale_policy_money,req.body.sale_num);
    if(req.body.product_type=="佣金"){
      params.sale_return_money=util.sub(params.sale_return_money,req.body.sale_other_money,2);
    }else if(req.body.product_type=="高打"){
      var temp = (req.body.purchase_other_money/req.body.purchase_number)*req.body.sale_num;
      temp = temp?temp:0;
      params.sale_return_money=util.sub(params.sale_return_money,temp,2);
    }

    if(req.body.sale_return_time){
      params.sale_return_time = new Date(req.body.sale_return_time).format('yyyy-MM-dd');
    }
    var front_message = req.body.front_sale_pay;
    sales.update(params,'sale_id',function(err,result){
      if(err){
        logger.error(req.session.user[0].realname + "修改销售出错" + err);
      }
      var message = req.session.user[0].realname+"修改销售应付。id："+params.sale_id;
      util.saveLogs(req.session.user[0].group_id,front_message,JSON.stringify(params),message);
      //销售回款时，更新政策
      // updateSalePolicy(req);
      updateAllotAccountDetail(req);
      res.json({"code":"000000",message:null});
    });
  }else{
    res.json({"code":"111112",message:"无权限"});
  }
});
//添加调货，并直接返款，则添加流水账信息
function updateAllotAccountDetail(req){
  var bankaccountdetail={};
  if(req.body.sale_account_id){
    bankaccountdetail.account_detail_deleta_flag = '0';
    bankaccountdetail.account_id = req.body.sale_account_id;
  }
  bankaccountdetail.account_detail_money = -req.body.sale_return_real_return_money;
  if(req.body.sale_return_time){
    bankaccountdetail.account_detail_time = new Date(req.body.sale_return_time).format('yyyy-MM-dd');
  }
  bankaccountdetail.account_detail_mark = req.body.bill_date+req.body.hospital_name+"销售"+
                                          req.body.product_common_name+"付积分"+req.body.sale_return_real_return_money;
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
//导出回款记录
router.post("/exportSalesRefund",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",136,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var findParam = JSON.stringify(req.body);
  req.body.data = JSON.parse(findParam);
  var sales = DB.get("Sales");
  var sql = getQuerySql(req);
  sql += " order by s.bill_date desc,s.hospital_id asc,s.sale_create_time asc";
  sales.executeSql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "导出销售记录出错" + err);
    }
    for(var i = 0 ; i< result.length;i++){
      if(result[i].product_type == '佣金' && result[i].refunds_real_time && !util.isEmpty(result[i].refunds_real_money)){
        	result[i].realMoney = util.div(result[i].refunds_real_money,result[i].sale_num,2);
      }else if(result[i].product_type == '高打' && result[i].refunds_real_time1 && !util.isEmpty(result[i].refunds_real_money1)){
         result[i].realMoney = util.div(result[i].refunds_real_money1,result[i].purchase_number,2);
      }else{
         result[i].realMoney = 0;
      }
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
    },{caption:'实收上游积分(单价)',type:'number'
    },{caption:'政策积分',type:'number'
    },{caption:'费用票/补点',type:'number',
      beforeCellWrite:function(row, cellData){
        if(row[17] == '佣金' && !util.isEmpty(cellData)){
          return cellData;
        }else if(row[17] == '高打' && !util.isEmpty(row[19])){
          var temp = (row[19]/row[18])*row[7];
          return Math.round(temp*100)/100;
        }else{
          return 0;
        }
      }
    },{caption:'应付积分',type:'number',
      beforeCellWrite:function(row, cellData){
        var temp = 0;
        if(row[17] == '佣金' && !util.isEmpty(cellData)){
          temp = row[12];
        }else if(row[17] == '高打' && !util.isEmpty(row[19])){
          var temp = (row[19]/row[18])*row[7];
          temp = Math.round(temp*100)/100;
        }
        var t = row[11]*row[7]-temp;
        t = Math.round(t*100)/100;
        if(cellData != t){
          return t;
        }else{
          return cellData;
        }
      }
    },{caption:'实付积分',type:'number'
    },{
        caption:'付积分时间',
        type:'string',
        beforeCellWrite:function(row, cellData){
          if(cellData){
            return new Date(cellData).format('yyyy-MM-dd');
          }else{
            return "";
          }
        }
    },{caption:'付积分备注',type:'string'
    },{caption:'',type:'string',
      beforeCellWrite:function(row, cellData){
        return "";
      }
    },{caption:'',type:'string',
      beforeCellWrite:function(row, cellData){
        return "";
      }
    },{caption:'',type:'string',
      beforeCellWrite:function(row, cellData){
        return "";
      }
    }];
    var header = ['bill_date', 'hospital_name', 'product_code', 'product_common_name', 'product_specifications',
                  'product_makesmakers','product_unit','sale_num','sale_price','sale_money','realMoney',
                  'sale_return_price','sale_other_money','sale_return_money','sale_return_real_return_money',
                  'sale_return_time','sale_policy_remark','product_type','purchase_number','purchase_other_money'];
    conf.rows = util.formatExcel(header,result);
    var result = nodeExcel.execute(conf);
    var message = req.session.user[0].realname+"导出销售应付。"+conf.rows.length+"条";
    util.saveLogs(req.session.user[0].group_id,"-",findParam,message);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats');
    res.setHeader("Content-Disposition", "attachment; filename=" + "Report.xlsx");
    res.end(result, 'binary');
  });
});
//销售回款查询
//查询销售记录
router.post("/getSalesReturnMoney",function(req,res){
  var noDate = new Date();
  if(req.session.user[0].authority_code.indexOf(",51,") > 0 || req.session.user[0].authority_code.indexOf(",127,") > 0){
    var sales = DB.get("Sales");
    var sql = getQuerySql(req);
    sales.countBySql(sql,function(err,result){
      if(err){
        logger.error(req.session.user[0].realname + "查询销售记录，统计总数出错" + err);
      }
      var numSql = "select sum(num.sale_return_money) as saleReturnMoney,sum(num.sale_return_real_return_money) as saleReturnMoney1 from ( " + sql + " ) num";
      sales.executeSql(numSql,function(err,money){
        if(err){
          logger.error(req.session.user[0].realname + "查询销售记录，统计金额出错" + err);
        }
        req.body.page.totalCount = result;
        req.body.page.saleReturnMoney = money && money[0].saleReturnMoney?Math.round(money[0].saleReturnMoney*100)/100:0;
        req.body.page.saleReturnMoney1 = money && money[0].saleReturnMoney1?Math.round(money[0].saleReturnMoney1*100)/100:0;
        req.body.page.totalPage = Math.ceil(req.body.page.totalCount / req.body.page.limit);
        sql += " order by s.bill_date desc,s.sale_create_time desc limit " + req.body.page.start + "," + req.body.page.limit + "";
        sales.executeSql(sql,function(err,result){
          if(err){
            logger.error(req.session.user[0].realname + "查询销售记录" + err);
          }
          for(var i = 0 ; i < result.length ;i++){
            result[i].sale_policy_money = result[i].sale_policy_money?result[i].sale_policy_money:0;
            result[i].sale_return_price = result[i].sale_return_price?result[i].sale_return_price:result[i].sale_policy_money;
            result[i].sale_return_money = result[i].sale_return_money?result[i].sale_return_money:0;
            result[i].sale_return_money = Math.round(result[i].sale_return_money*100)/100;
            result[i].product_return_money =  result[i].hospital_policy_return_money?result[i].hospital_policy_return_money:result[i].product_return_money;

            result[i].refunds_real_time = result[i].refunds_real_time1?result[i].refunds_real_time1:result[i].refunds_real_time;
            result[i].refunds_real_money = result[i].refunds_real_money1?result[i].refunds_real_money1:result[i].refunds_real_money;
          }
          req.body.page.data = result;
          logger.error(req.session.user[0].realname + "sales-getSales运行时长" + (noDate.getTime()-new Date().getTime()));
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
  var sql = "select s.sale_id,s.bill_date,s.sale_type,s.sale_price,s.sale_num,s.sale_money,s.real_gross_profit,s.accounting_cost,s.gross_profit,"+
            "s.sale_account_name,s.sale_account_number,s.sale_account_address,s.batch_number,s.sales_purchase_id,"+
            "s.sale_return_time,s.sale_account_id,sp.sale_policy_remark,sp.sale_policy_money,sp.sale_policy_contact_id,"+
            "s.cost_univalent,bus.business_name,s.hospital_id,h.hospital_name,d.product_id,d.stock,d.product_type,d.buyer,d.product_business,"+
            "s.sale_return_price,s.sale_contact_id,d.product_common_name,d.product_specifications,s.sale_return_money,"+
            "d.product_makesmakers,d.product_unit,d.product_packing,d.product_return_money,d.product_code,c.contacts_name,r.refunds_real_time,"+
            "r.refunds_real_money,p.purchase_number,p.purchase_other_money,s.sale_other_money,s.sale_return_real_return_money,hpr.hospital_policy_return_money,"+
            "rs1.refunds_real_time as refunds_real_time1,rs1.refunds_real_money as refunds_real_money1 "+
            "from sales s "+
            "left join drugs d on s.product_code = d.product_code "+
            "left join sale_policy sp on s.hospital_id = sp.sale_hospital_id and d.product_id = sp.sale_drug_id "+//取上游是否返款
            "left join purchase p on p.purchase_id = s.sales_purchase_id "+//取上游备货数量，计算实返金额
            "left join refunds r on r.sales_id = s.sale_id "+
            "left join refunds rs1 on s.sales_purchase_id = rs1.purchases_id "+
            "left join hospital_policy_record hpr on s.hospital_id = hpr.hospital_policy_hospital_id and d.product_id = hpr.hospital_policy_drug_id and hpr.hospital_policy_delete_flag !='1' "+
            "left join business bus on d.product_business = bus.business_id "+
            "left join hospitals h on s.hospital_id = h.hospital_id "+
            "left join contacts c on c.contacts_id = d.contacts_id "+
            "where s.delete_flag = '0' and s.group_id = '"+req.session.user[0].group_id+"' "+
            "and d.delete_flag = '0' and d.group_id = '"+req.session.user[0].group_id+"' ";
  //数据权限
  if(req.session.user[0].data_authority == "2"){
    sql += "and s.sale_create_userid = '"+req.session.user[0].id+"'";
  }
  if(!util.isEmpty(req.body.data.productCommonNam)){
    sql += " and (d.product_common_name like '%"+req.body.data.productCommonName+"%' or d.product_name_pinyin like '%"+req.body.data.productCommonName+"%')";
  }
  if(!util.isEmpty(req.body.data.product_code)){
    sql += " and d.product_code = '"+req.body.data.product_code+"'"
  }
  if(!util.isEmpty(req.body.data.product_makesmakers)){
    sql += " and d.product_makesmakers like '%"+req.body.data.product_makesmakers+"%'"
  }
  if(!util.isEmpty(req.body.data.productType)){
    var type = req.body.data.productType;
    if(typeof type == 'object'){
      var t = type.join(",").replace(/,/g,"','");
      sql += " and d.product_type in ('"+t+"')"
    }else{
      sql += " and d.product_type in ('"+type+"')"
    }
  }
  if(!util.isEmpty(req.body.data.hospitalsId)){
    sql += " and s.hospital_id = '"+req.body.data.hospitalsId+"'"
  }
  if(!util.isEmpty(req.body.data.business)){
    sql += " and d.product_business = '"+req.body.data.business+"'"
  }
  if(!util.isEmpty(req.body.data.sale_type)){
    sql += " and s.sale_type = '"+req.body.data.sale_type+"'"
  }
  if(!util.isEmpty(req.body.data.contactId)){
    sql += " and d.contacts_id = '"+req.body.data.contactId+"'"
  }
  if(!util.isEmpty(req.body.data.sale_contact_id)){
    sql += " and sp.sale_policy_contact_id = '"+req.body.data.sale_contact_id+"'"
  }
  if(req.body.data.salesTime){
    var start = new Date(req.body.data.salesTime[0]).format("yyyy-MM-dd");
    var end = new Date(req.body.data.salesTime[1]).format("yyyy-MM-dd");
    sql += " and DATE_FORMAT(s.bill_date,'%Y-%m-%d') >= '"+start+"' and DATE_FORMAT(s.bill_date,'%Y-%m-%d') <= '"+end+"'";
  }
  if(req.body.data.salesReturnTime){
    var start = new Date(req.body.data.salesReturnTime[0]).format("yyyy-MM-dd");
    var end = new Date(req.body.data.salesReturnTime[1]).format("yyyy-MM-dd");
    sql += " and DATE_FORMAT(s.sale_return_time,'%Y-%m-%d') >= '"+start+"' and DATE_FORMAT(s.sale_return_time,'%Y-%m-%d') <= '"+end+"'";
  }
  if(req.body.data.sale_return_flag){
    sql += req.body.data.sale_return_flag=="已付"?" and s.sale_return_time is not null":" and s.sale_return_time is null";
  }
  if(!util.isEmpty(req.body.data.rate_gap) && req.body.data.rate_gap!=0){
    sql += " and (s.sale_price-s.accounting_cost)*100/s.sale_price  "+req.body.data.rate_formula+" "+req.body.data.rate_gap+" "
  }
  if(!util.isEmpty(req.body.data.salesReturnFlag)){
    sql += " and sp.sale_policy_money is not null and sp.sale_policy_money !=''";
  }
  return sql;
}

router.post("/editPurchasePayBatchPolicy",function(req,res){
  if(!(req.session.user[0].authority_code.indexOf(",157,") > 0 || req.session.user[0].authority_code.indexOf(",160,") > 0) ){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var purchasePayPolicy = DB.get("PurchasePayPolicy");
  var sql = "insert into purchase_pay_policy(purchase_pay_contact_id,purchase_pay_policy_drug_id,purchase_pay_policy_floor_price,purchase_pay_policy_tax,purchase_pay_policy_price,purchase_pay_policy_remark,purchase_pay_policy_make_price) values ";
  var drug = req.body.purchasePayDrugs;
  var ids = "",contactsIds="";
  for(var i = 0 ; i < drug.length ;i++){
    contactsIds += "'"+drug[i].contacts_id+"',";
    ids += "'"+drug[i].id+"',";
    sql += "('"+drug[i].contacts_id+"','"+drug[i].id+"','"+req.body.purchase_pay_policy_floor_price+"','"+req.body.purchase_pay_policy_tax+"','"+req.body.purchase_pay_policy_price+"','"+req.body.purchase_pay_policy_remark+"','"+req.body.purchase_pay_policy_make_price+"'),";
  }
  sql = sql.substring(0,sql.length-1);
  sql +=" ON DUPLICATE KEY UPDATE purchase_pay_policy_floor_price=VALUES(purchase_pay_policy_floor_price),purchase_pay_policy_tax=VALUES(purchase_pay_policy_tax),purchase_pay_policy_price=VALUES(purchase_pay_policy_price),"+
            "purchase_pay_policy_remark=VALUES(purchase_pay_policy_remark),purchase_pay_policy_make_price=VALUES(purchase_pay_policy_make_price)";
  purchasePayPolicy.executeSql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "批量更新预付招商政策药品政策，出错" + err);
    }
    var message = req.session.user[0].realname+"批量新增、修改预付招商政策下游。";
    var front_message = req.body.front_message?req.body.front_message:"-";
    delete req.body.front_message;
    util.saveLogs(req.session.user[0].group_id,front_message,JSON.stringify(req.body),message);
    res.json({"code":"000000",message:""});
  });
  contactsIds = contactsIds.substring(0,contactsIds.length-1);
  ids = ids.substring(0,ids.length-1);

  var getPurchasePaySql = "select * from purchase_pay "+
                      "where purchase_pay_group_id = '"+req.session.user[0].group_id+"' and purchase_pay_contact_id in ("+contactsIds+") "+
                      "and purchase_pay_drug_id in ("+ids+") and (purchase_pay_real_account is null or purchase_pay_real_account = '') "+
                      "and (purchase_pay_policy_price is null or purchase_pay_should_pay_money is null or "+
                      "purchase_pay_policy_price = '' or purchase_pay_should_pay_money = '' or "+
                      "purchase_pay_policy_price = '0')";
  purchasePayPolicy.executeSql(getPurchasePaySql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "批量更新政策后，更新预付招商应付更新出错" + err);
    }
    var updatePurchasePay = "insert into purchase_pay (purchase_pay_id,purchase_pay_policy_price,purchase_pay_should_pay_money,purchase_pay_group_id) values ";
    var updateFlag = false;
    for(var i = 0 ; i < result.length;i++){
      updateFlag = true;
      var price=0,money=0;
      if(!util.isEmpty(req.body.purchase_pay_policy_floor_price) && !util.isEmpty(req.body.purchase_pay_policy_tax) && !util.isEmpty(req.body.purchase_pay_policy_make_price)){
        price = (result[i].purchase_pay_price-req.body.purchase_pay_policy_floor_price)*(1-req.body.purchase_pay_policy_tax/100);
        money = price * result[i].purchase_pay_number -result[i].purchase_pay_other_money;
      }else if(!util.isEmpty(req.body.purchase_pay_policy_price) ){
        price = req.body.purchase_pay_policy_price;
        money = price * result[i].purchase_pay_number -result[i].purchase_pay_other_money;
      }
      price = Math.round(price*100)/100;
      money = Math.round(money*100)/100;
      updatePurchasePay+="('"+result[i].purchase_pay_id+"','"+price+"','"+money+"','"+result[i].purchase_pay_group_id+"'),"
    }
    if(updateFlag){
      updatePurchasePay = updatePurchasePay.substring(0,updatePurchasePay.length-1);
      updatePurchasePay +=" on duplicate key update purchase_pay_group_id=values(purchase_pay_group_id),purchase_pay_policy_price=values(purchase_pay_policy_price),purchase_pay_should_pay_money=values(purchase_pay_should_pay_money)";
      purchasePayPolicy.executeSql(updatePurchasePay,function(err,result){
        if(err){
          logger.error(req.session.user[0].realname + "批量更新政策后，将所有的预付招商记录更新出错" + err);
        }
      });
    }
  });
});
//新增政策
router.post("/editPurchasePayPolicy",function(req,res){
  if(!(req.session.user[0].authority_code.indexOf(",157,") > 0 || req.session.user[0].authority_code.indexOf(",160,") > 0) ){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var purchasePayPolicy = DB.get("PurchasePayPolicy");
  var sql = "insert into purchase_pay_policy(purchase_pay_contact_id,purchase_pay_policy_drug_id,purchase_pay_policy_floor_price,purchase_pay_policy_tax,purchase_pay_policy_price,purchase_pay_policy_remark,purchase_pay_policy_make_price";
      sql+=") values ('"+req.body.purchase_pay_contact_id+"','"+req.body.purchase_pay_policy_drug_id+"','"+req.body.purchase_pay_policy_floor_price+"','"+req.body.purchase_pay_policy_tax+"','"+req.body.purchase_pay_policy_price+"','"+req.body.purchase_pay_policy_remark+"','"+req.body.purchase_pay_policy_make_price+"'";
      sql +=") ON DUPLICATE KEY UPDATE purchase_pay_policy_floor_price=VALUES(purchase_pay_policy_floor_price),purchase_pay_policy_tax=VALUES(purchase_pay_policy_tax),purchase_pay_policy_price=VALUES(purchase_pay_policy_price),"+
            "purchase_pay_policy_remark=VALUES(purchase_pay_policy_remark),purchase_pay_policy_make_price=VALUES(purchase_pay_policy_make_price)";
  purchasePayPolicy.executeSql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "更新预付招商政策药品政策，出错" + err);
    }

    var message = req.session.user[0].realname+"新增、修改预付招商政策下游。";
    var front_message = req.body.front_message?req.body.front_message:"-";
    delete req.body.front_message;
    util.saveLogs(req.session.user[0].group_id,front_message,JSON.stringify(req.body),message);
    res.json({"code":"000000",message:""});
  });

  var getPurchasePaySql = "select * from purchase_pay "+
                      "where purchase_pay_group_id = '"+req.session.user[0].group_id+"' and purchase_pay_contact_id = '"+req.body.purchase_pay_contact_id+"' "+
                      "and purchase_pay_drug_id = '"+req.body.purchase_pay_policy_drug_id+"' and (purchase_pay_real_account is null or purchase_pay_real_account = '') "+
                      "and (purchase_pay_policy_price is null or purchase_pay_should_pay_money is null or "+
                      "purchase_pay_policy_price = '' or purchase_pay_should_pay_money = '' or "+
                      "purchase_pay_policy_price = '0')";
  purchasePayPolicy.executeSql(getPurchasePaySql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "更新政策后，更新预付招商应付更新出错" + err);
    }
    var updatePurchasePay = "insert into purchase_pay (purchase_pay_id,purchase_pay_policy_price,purchase_pay_should_pay_money,purchase_pay_group_id) values ";
    var updateFlag = false;
    for(var i = 0 ; i < result.length;i++){
      updateFlag = true;
      var price=0,money=0;
      if(!util.isEmpty(req.body.purchase_pay_policy_floor_price) && !util.isEmpty(req.body.purchase_pay_policy_tax) && !util.isEmpty(req.body.purchase_pay_policy_make_price)){
        price = (result[i].purchase_pay_price-req.body.purchase_pay_policy_floor_price)*(1-req.body.purchase_pay_policy_tax/100);
        money = price * result[i].purchase_pay_number -result[i].purchase_pay_other_money;
      }else if(!util.isEmpty(req.body.purchase_pay_policy_price) ){
        price = req.body.purchase_pay_policy_price;
        money = price * result[i].purchase_pay_number -result[i].purchase_pay_other_money;
      }
      price = Math.round(price*100)/100;
      money = Math.round(money*100)/100;
      updatePurchasePay+="('"+result[i].purchase_pay_id+"','"+price+"','"+money+"','"+result[i].purchase_pay_group_id+"'),"
    }
    if(updateFlag){
      updatePurchasePay = updatePurchasePay.substring(0,updatePurchasePay.length-1);
      updatePurchasePay +=" on duplicate key update purchase_pay_group_id=values(purchase_pay_group_id),purchase_pay_policy_price=values(purchase_pay_policy_price),purchase_pay_should_pay_money=values(purchase_pay_should_pay_money)";
      purchasePayPolicy.executeSql(updatePurchasePay,function(err,result){
        if(err){
          logger.error(req.session.user[0].realname + "更新政策后，将所有的预付招商记录更新出错" + err);
        }
      });
    }
  });
});
//导出
router.post("/exportPurchasePayPolicy",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",161,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var findParam = JSON.stringify(req.body);
  req.body.data = JSON.parse(findParam);
  var purchasePayPolicy = DB.get("PurchasePayPolicy");
  var sql = getPurchasePayPolicySql(req);
  sql += " order by dsp.product_create_time asc";
  purchasePayPolicy.executeSql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "导出预付招商政策出错" + err);
    }
    var conf ={};
    conf.stylesXmlFile = "./utils/styles.xml";
    conf.name = "mysheet";
    conf.cols = [{caption:'联系人',type:'string'
    },{caption:'产品编码',type:'string'
    },{caption:'产品名称',type:'string'
    },{caption:'产品规格',type:'string'
    },{caption:'生产厂家',type:'string'
    },{caption:'单位',type:'string'
    },{caption:'商业',type:'string'
    },{caption:'中标价',type:'number'
    },{caption:'积分',type:'string'
    },{caption:'预付政策积分',type:'string'
    },{caption:'积分备注',type:'string'
    }];
    var header = ['contacts_name','product_code', 'product_common_name', 'product_specifications',
                  'product_makesmakers','product_unit','business_name','product_price','product_return_money','purchase_pay_policy_price',
                  'purchase_pay_policy_remark'];
    conf.rows = util.formatExcel(header,result);
    var result = nodeExcel.execute(conf);
    var message = req.session.user[0].realname+"导出预付招商政策。"+conf.rows.length+"条";
    util.saveLogs(req.session.user[0].group_id,"-",findParam,message);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats');
    res.setHeader("Content-Disposition", "attachment; filename=" + "Report.xlsx");
    res.end(result, 'binary');
  });
});
//查询销售政策
router.post("/getPurchasePayPolicy",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",159,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var sql = "";
  if(req.body.data.requestFrom == "drugsPurchasePayPolicy"){
    sql = getHospitalPurchasePayPolicySql(req);
  }else{
    sql = getPurchasePayPolicySql(req);
  }
  var purchasePayPolicy = DB.get("PurchasePayPolicy");
  purchasePayPolicy.countBySql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "查询预付招商政策分页列表，统计总数出错" + err);
    }
    req.body.page.totalCount = result;
    req.body.page.totalPage = Math.ceil(req.body.page.totalCount / req.body.page.limit);
    if(req.body.data.requestFrom == "drugsPurchasePayPolicy"){
      sql += " order by d.contact_create_time desc limit " + req.body.page.start + "," + req.body.page.limit + "";
    }else{
      sql += " order by dsp.product_create_time desc limit " + req.body.page.start + "," + req.body.page.limit + "";
    }
    purchasePayPolicy.executeSql(sql,function(err,result){
      if(err){
        logger.error(req.session.user[0].realname + "查询预付招商政策分页列表，出错" + err);
      }
      req.body.page.data = result;
      res.json({"code":"000000",message:req.body.page});
    });
  });
});
function getHospitalPurchasePayPolicySql(req){
   var drugsSql = "select dd.*,c.contacts_name,c.contacts_id as contacts_id1,c.contact_create_time from drugs dd,contacts c where dd.product_code = '"+req.body.data.productCode+"' and dd.delete_flag='0' and dd.group_id = '"+req.session.user[0].group_id+"' "+
                 "and c.delete_flag = '0' and c.group_id = '"+req.session.user[0].group_id+"' and c.contact_type like '%业务员%' ";
   var sql = "select * from ("+drugsSql+") d left join purchase_pay_policy ppp on ppp.purchase_pay_contact_id = d.contacts_id1 and d.product_id = ppp.purchase_pay_policy_drug_id "+
             "left join business b on d.product_business = b.business_id where 1=1 ";
   if(!util.isEmpty(req.body.data.contactId)){
     sql += " and ppp.purchase_pay_contact_id = '"+req.body.data.contactId+"'";
   }
   if(req.body.data.purchase_pay_query_type == "已设置"){
     sql += " and ppp.purchase_pay_policy_price is not null and ppp.purchase_pay_policy_price !=''";
   }else if(req.body.data.purchase_pay_query_type == "未设置"){
     sql += " and (ppp.purchase_pay_policy_price is null or ppp.purchase_pay_policy_price ='')";
   }
   return sql;
}
function getPurchasePayPolicySql(req){
  //药品连接政策
  var sql = "select * from purchase_pay_policy ppp left join drugs d on d.product_id = ppp.purchase_pay_policy_drug_id "+
            " where d.delete_flag='0' and d.group_id = '"+req.session.user[0].group_id+"' "+
            " and d.product_type = '高打' and ppp.purchase_pay_policy_price is not null and ppp.purchase_pay_policy_price !=''";
  if(!util.isEmpty(req.body.data.productCommonName)){
    sql += " and (d.product_common_name like '%"+req.body.data.productCommonName+"%' or d.product_name_pinyin like '%"+req.body.data.productCommonName+"%')";
  }
  if(!util.isEmpty(req.body.data.contactId)){
    sql += " and ppp.purchase_pay_contact_id = '"+req.body.data.contactId+"'";
  }
  if(!util.isEmpty(req.body.data.productCode)){
    sql += " and d.product_code = '"+req.body.data.productCode+"'";
  }
  //连接业务员
  sql = "select dsc.*,c.contacts_name from ("+sql+") dsc left join contacts c on dsc.purchase_pay_contact_id = c.contacts_id";
  //连接商业
  sql = "select * from ("+sql+") dsp left join business b on dsp.product_business = b.business_id";
  return sql;
}
//查询销售未添加药品政策
router.post("/getPurchasePolicyDrugs",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",157,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var sql = getPurchasePayPolicyDrugsSql(req);
  var purchasePayPolicy = DB.get("PurchasePayPolicy");
  purchasePayPolicy.countBySql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "查询预付招商政策，选择未添加药品分页列表，统计总数出错" + err);
    }
    req.body.page.totalCount = result;
    req.body.page.totalPage = Math.ceil(req.body.page.totalCount / req.body.page.limit);
    sql += " order by dsp.product_create_time desc limit " + req.body.page.start + "," + req.body.page.limit + "";
    purchasePayPolicy.executeSql(sql,function(err,result){
      if(err){
        logger.error(req.session.user[0].realname + "查询预付招商政策，选择未添加药品分页列表，出错" + err);
      }
      req.body.page.data = result;
      res.json({"code":"000000",message:req.body.page});
    });
  });
});
function getPurchasePayPolicyDrugsSql(req){
  //药品连接政策
  var sql = "select * from drugs d left join purchase_pay_policy ppp on d.product_id = ppp.purchase_pay_policy_drug_id "+
            " and (ppp.purchase_pay_contact_id = '"+req.body.data.contactId+"' or ppp.purchase_pay_contact_id is null) "+
            " where d.delete_flag='0' and d.group_id = '"+req.session.user[0].group_id+"' "+
            " and d.product_type ='高打' and (ppp.purchase_pay_policy_price is null or ppp.purchase_pay_policy_price ='') ";
  if(!util.isEmpty(req.body.data.productCommonName)){
    sql += " and (d.product_common_name like '%"+req.body.data.productCommonName+"%' or d.product_name_pinyin like '%"+req.body.data.productCommonName+"%')";
  }
  if(!util.isEmpty(req.body.data.productCode)){
    sql += " and d.product_code = '"+req.body.data.productCode+"'";
  }
  //连接商业
  sql = "select * from ("+sql+") dsp left join business b on dsp.product_business = b.business_id";
  return sql;
}
module.exports = router;
