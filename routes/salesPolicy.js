var express = require("express");
var pinyin = require("node-pinyin");
var nodeExcel = require('excel-export');
var logger = require('../utils/logger');
var util= require('../utils/global_util.js');
var parse = require('csv-parse');
var XLSX = require("xlsx");
var router = express.Router();

//导出回款记录
router.post("/exportSalesRefund",function(req,res){
  if(req.session.user[0].authority_code.indexOf("136,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  req.body.data = req.body;
  var sales = DB.get("Sales");
  var sql = getQuerySql(req);
  sql += " order by s.bill_date desc,s.hospital_id asc,s.sale_create_time asc";
  sales.executeSql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "导出销售记录出错" + err);
    }
    for(var i = 0 ; i< result.length;i++){
      if(result[i].product_type == '佣金' && result[i].refunds_real_time && result[i].refunds_real_money){
        	result[i].realMoney = util.div(result[i].refunds_real_money,result[i].sale_num,2);
      }else if(result[i].product_type == '高打' && result[i].refunds_real_time && result[i].refunds_real_money){
         result[i].realMoney = util.div(result[i].refunds_real_money,result[i].purchase_number,2);
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
        if(row[16] == '佣金' && cellData){
          return cellData;
        }else if(row[16] == '高打' && row[18]){
          var temp = (row[18]/row[17])*row[7];
          return Math.round(temp*100)/100;
        }else{
          return 0;
        }
      }
    },{caption:'应付积分',type:'number'
    },{
        caption:'回积分时间',
        type:'string',
        beforeCellWrite:function(row, cellData){
          if(cellData){
            return new Date(cellData).format('yyyy-MM-dd');
          }else{
            return "";
          }
        }
    },{caption:'回积分备注',type:'string'
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
                  'sale_return_price','sale_other_money','sale_return_money',
                  'sale_return_time','sale_policy_remark','product_type','purchase_number','purchase_other_money'];
    conf.rows = util.formatExcel(header,result);
    var result = nodeExcel.execute(conf);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats');
    res.setHeader("Content-Disposition", "attachment; filename=" + "Report.xlsx");
    res.end(result, 'binary');
  });
});
//销售回款查询
//查询销售记录
router.post("/getSalesReturnMoney",function(req,res){
  var noDate = new Date();
  if(req.session.user[0].authority_code.indexOf("51,") > 0 || req.session.user[0].authority_code.indexOf("127,") > 0){
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
            "r.refunds_real_money,p.purchase_number,p.purchase_other_money,s.sale_other_money,s.sale_return_real_return_money "+
            "from sales s "+
            "left join drugs d on s.product_code = d.product_code "+
            "left join sale_policy sp on s.hospital_id = sp.sale_hospital_id and d.product_id = sp.sale_drug_id "+//取上游是否返款
            "left join purchase p on p.purchase_id = s.sales_purchase_id "+//取上游备货数量，计算实返金额
            "left join refunds r on r.sales_id = s.sale_id or r.purchases_id = s.sales_purchase_id "+
            "left join business bus on d.product_business = bus.business_id "+
            "left join hospitals h on s.hospital_id = h.hospital_id "+
            "left join contacts c on c.contacts_id = d.contacts_id "+
            "where s.delete_flag = '0' and s.group_id = '"+req.session.user[0].group_id+"' "+
            "and d.delete_flag = '0' and d.group_id = '"+req.session.user[0].group_id+"' ";
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
  if(req.body.data.product_makesmakers){
    sql += " and d.product_makesmakers like '%"+req.body.data.product_makesmakers+"%'"
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
  if(req.body.data.rate_gap && req.body.data.rate_gap!=0){
    sql += " and (s.sale_price-s.accounting_cost)*100/s.sale_price  "+req.body.data.rate_formula+" "+req.body.data.rate_gap+" "
  }
  if(req.body.data.salesReturnFlag){
    sql += " and sp.sale_policy_money is not null and sp.sale_policy_money !=''";
  }
  return sql;
}
//复制销售政策
router.post("/copySalesPolicy",function(req,res){
  if(req.session.user[0].authority_code.indexOf("131,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var salePolicy = DB.get("SalePolicy");
  //查询所有选择的销售政策
  var sql = "select * from sale_policy sp where sp.sale_hospital_id = '"+req.body.hospital_id+"'";
  salePolicy.executeSql(sql,function(err,d){
    if(err){
      logger.error(req.session.user[0].realname + "复制销售政策，查询已选择销售出错" + err);
    }
    var copySql = "insert into sale_policy(sale_hospital_id,sale_drug_id,sale_policy_money,sale_policy_remark,sale_policy_contact_id) values ";
    for(var i = 0 ; i < d.length ;i++){
      copySql += "('"+req.body.hospital_id_copy+"','"+d[i].sale_drug_id+"','"+d[i].sale_policy_money+"','"+d[i].sale_policy_remark+"','"+d[i].sale_policy_contact_id+"'),";
    }
    copySql = copySql.substring(0,copySql.length-1);
    copySql += " ON DUPLICATE KEY UPDATE sale_policy_money=VALUES(sale_policy_money),sale_policy_remark=VALUES(sale_policy_remark),sale_policy_contact_id=VALUES(sale_policy_contact_id)";
    salePolicy.executeSql(copySql,function(err,d){
      if(err){
        logger.error(req.session.user[0].realname + "复制销售政策，复制销售出错" + err);
      }
      res.json({"code":"000000",message:""});
    });


    var getSalesSql = "select s.*,d.product_id from sales s left join drugs d on d.product_code = s.product_code "+
                      "where s.group_id = '"+req.session.user[0].group_id+"' "+
                      "and d.delete_flag = '0' and d.group_id = '"+req.session.user[0].group_id+"' "+
                      "and s.delete_flag = '0' and (s.sale_account_id is null or s.sale_account_id = '' ) "+
                      "and s.hospital_id = '"+req.body.hospital_id_copy+"'";
    salePolicy.executeSql(getSalesSql,function(err,result){//查询所有，政策相关的调货记录，用于更新调货政策
      if(err){
        logger.error(req.session.user[0].realname + "更新政策前，查询要更新的销售记录更新出错" + err);
      }
      var salesHospital = "insert into sales (sale_id,sale_return_price,sale_return_money) values "
      var updateFlag = false;
      for(var m=0; m<d.length; m++){//这个循环，查询被复制医院的调货政策
        for(var j = 0 ; j < result.length ;j++){//这个循环，查询要更新-复制政策目标医院，的调货记录，根据记录id更新
          if(d[m].sale_drug_id == result[j].product_id){
            updateFlag=true;
            var t = util.mul(d[m].sale_policy_money,result[j].sale_num,2);
            salesHospital+="('"+result[j].sale_id+"','"+d[m].sale_policy_money+"','"+t+"'),";
          }
        }
      }
      if(updateFlag){//判断是否更新
        salesHospital = salesHospital.substring(0,salesHospital.length-1);
        salesHospital +=" on duplicate key update sale_return_price=values(sale_return_price),sale_return_money=values(sale_return_money)";
        salePolicy.executeSql(salesHospital,function(err,result){//更新记录
          if(err){
            logger.error(req.session.user[0].realname + "更新政策后，将所有的销售记录更新出错" + err);
          }
        });
      }
    });
  });
});

//批量新增政策
router.post("/editSalesPolicy",function(req,res){
  if(req.session.user[0].authority_code.indexOf("131,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var salePolicy = DB.get("SalePolicy");
  var sql = "insert into sale_policy(sale_hospital_id,sale_drug_id,sale_policy_money,sale_policy_remark,sale_policy_contact_id";
      sql+=") values ('"+req.body.sale_hospital_id+"','"+req.body.sale_drug_id+"','"+req.body.sale_policy_money+"','"+req.body.sale_policy_remark+"','"+req.body.sale_policy_contact_id+"'";
      sql +=") ON DUPLICATE KEY UPDATE sale_policy_money=VALUES(sale_policy_money),sale_policy_remark=VALUES(sale_policy_remark),sale_policy_contact_id=VALUES(sale_policy_contact_id)";
  salePolicy.executeSql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "更新销售医院药品政策，出错" + err);
    }
    res.json({"code":"000000",message:""});
  });
  //
  // var saleHospital = "update sales set sale_return_price = '"+req.body.sale_policy_money+"',sale_return_money=sale_num*"+req.body.sale_policy_money+" "+
  //                     "where group_id = '"+req.session.user[0].group_id+"' and hospital_id = '"+req.body.sale_hospital_id+"' "+
  //                     "and product_code = '"+req.body.product_code+"' and (sale_account_id is null or sale_account_id = '') ";
  // salePolicy.executeSql(saleHospital,function(err,result){
  //   if(err){
  //     logger.error(req.session.user[0].realname + "更新政策后，将所有的销售记录回款信息更新出错" + err);
  //   }
  // });
});
//修改销售政策
router.post("/editSalesPolicyBatch",function(req,res){
  if(req.session.user[0].authority_code.indexOf("131,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var salePolicy = DB.get("SalePolicy");
  var sql = "insert into sale_policy(sale_hospital_id,sale_drug_id,sale_policy_money,sale_policy_remark,sale_policy_contact_id) values ";
  var drug = req.body.saleDrugs;
  for(var i = 0 ; i < drug.length ;i++){
    var p = (req.body.type=="2"||req.body.type=="4")?drug[i].price:drug[i].returnMoney;
    p=p?p:0;
    var policyMoney = 0;
    if(req.body.type=="2"||req.body.type=="3"){
      policyMoney = Math.round(p*req.body.policy_percent)/100;
    }else{
      policyMoney = drug[i].returnMoney - (p*req.body.policy_percent)/100;
      policyMoney = Math.round(policyMoney*100)/100;
    }
    var hospitalId = drug[i].hospitalId?drug[i].hospitalId:req.body.sale_hospital_id;
    sql+="('"+hospitalId+"','"+drug[i].id+"','"+policyMoney+"','"+req.body.sale_policy_remark+"','"+req.body.sale_policy_contact_id+"'),";
  }
  sql = sql.substring(0,sql.length-1);
  sql +=" ON DUPLICATE KEY UPDATE sale_policy_money=VALUES(sale_policy_money),sale_policy_remark=VALUES(sale_policy_remark),sale_policy_contact_id=VALUES(sale_policy_contact_id)";
  salePolicy.executeSql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "批量新增销售医院药品政策，出错" + err);
    }
    res.json({"code":"000000",message:""});
  });

  // var saleHospital = "update sales set sale_return_price = '"+req.body.sale_policy_money+"',sale_return_money=sale_num*"+req.body.sale_policy_money+" "+
  //                     "where group_id = '"+req.session.user[0].group_id+"' and hospital_id = '"+req.body.sale_hospital_id+"' "+
  //                     "and product_code = '"+req.body.product_code+"' and (sale_account_id is null or sale_account_id = '') ";
  // salePolicy.executeSql(saleHospital,function(err,result){
  //   if(err){
  //     logger.error(req.session.user[0].realname + "更新政策后，将所有的销售记录回款信息更新出错" + err);
  //   }
  // });
});
//导出
router.post("/exportSalesPolicy",function(req,res){
  if(req.session.user[0].authority_code.indexOf("134,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  req.body.data = req.body;
  var salePolicy = DB.get("SalePolicy");
  var sql = getSalesPolicySql(req);
  sql += " order by dsp.product_create_time asc";
  salePolicy.executeSql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "导出销售政策出错" + err);
    }
    var conf ={};
    conf.stylesXmlFile = "./utils/styles.xml";
    conf.name = "mysheet";
    conf.cols = [{caption:'产品编码',type:'string'
    },{caption:'产品名称',type:'string'
    },{caption:'产品规格',type:'string'
    },{caption:'生产厂家',type:'string'
    },{caption:'单位',type:'string'
    },{caption:'商业',type:'string'
    },{caption:'中标价',type:'number'
    },{caption:'政策积分',type:'string'
    },{caption:'销售积分',type:'string'
    },{caption:'积分备注',type:'string'
    },{caption:'业务员',type:'string'
    }];
    var header = ['product_code', 'product_common_name', 'product_specifications',
                  'product_makesmakers','product_unit','business_name','product_price','product_return_money','sale_policy_money',
                  'sale_policy_remark','contacts_name'];
    conf.rows = util.formatExcel(header,result);
    var result = nodeExcel.execute(conf);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats');
    res.setHeader("Content-Disposition", "attachment; filename=" + "Report.xlsx");
    res.end(result, 'binary');
  });
});
//查询销售政策
router.post("/getSalesPolicy",function(req,res){
  if(req.session.user[0].authority_code.indexOf("130,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var sql = getSalesPolicySql(req);
  var salePolicy = DB.get("SalePolicy");
  salePolicy.countBySql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "查询销售医院药品政策分页列表，统计总数出错" + err);
    }
    req.body.page.totalCount = result;
    req.body.page.totalPage = Math.ceil(req.body.page.totalCount / req.body.page.limit);
    sql += " order by dsp.product_create_time desc limit " + req.body.page.start + "," + req.body.page.limit + "";
    salePolicy.executeSql(sql,function(err,result){
      if(err){
        logger.error(req.session.user[0].realname + "查询销售医院药品政策分页列表，出错" + err);
      }
      req.body.page.data = result;
      res.json({"code":"000000",message:req.body.page});
    });
  });
});
function getSalesPolicySql(req){
  //药品连接政策
  var sql = "select * from sale_policy sp left join drugs d on d.product_id = sp.sale_drug_id "+
            " where d.delete_flag='0' and d.group_id = '"+req.session.user[0].group_id+"' "+
            " and d.product_type in ('佣金','高打') and sp.sale_policy_money != '' and sp.sale_policy_money is not null ";
  if(req.body.data.hospitalId){
    sql += " and sp.sale_hospital_id = '"+req.body.data.hospitalId+"' ";
  }
  if(req.body.data.productCommonName){
    sql += " and (d.product_common_name like '%"+req.body.data.productCommonName+"%' or d.product_name_pinyin like '%"+req.body.data.productCommonName+"%')";
  }
  if(req.body.data.sale_contact_id){
    sql += " and sp.sale_policy_contact_id = '"+req.body.data.sale_contact_id+"'";
  }
  if(req.body.data.productCode){
    sql += " and d.product_code = '"+req.body.data.productCode+"'";
  }
  //连接业务员
  sql = "select dsc.*,c.contacts_name from ("+sql+") dsc left join contacts c on dsc.sale_policy_contact_id = c.contacts_id";
  //连接销往单位
  sql = "select dsch.*,h.hospital_name from ("+sql+") dsch left join hospitals h on dsch.sale_hospital_id = h.hospital_id "
  //连接商业
  sql = "select * from ("+sql+") dsp left join business b on dsp.product_business = b.business_id";
  return sql;
}
//查询销售未添加药品政策
router.post("/getSalesPolicyDrugs",function(req,res){
  if(req.session.user[0].authority_code.indexOf("118,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var sql = getSalesPolicyDrugsSql(req);
  var salePolicy = DB.get("SalePolicy");
  salePolicy.countBySql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "查询销售医院药品政策，选择未添加药品分页列表，统计总数出错" + err);
    }
    req.body.page.totalCount = result;
    req.body.page.totalPage = Math.ceil(req.body.page.totalCount / req.body.page.limit);
    sql += " order by dsp.product_create_time desc limit " + req.body.page.start + "," + req.body.page.limit + "";
    salePolicy.executeSql(sql,function(err,result){
      if(err){
        logger.error(req.session.user[0].realname + "查询销售医院药品政策，选择未添加药品分页列表，出错" + err);
      }
      req.body.page.data = result;
      res.json({"code":"000000",message:req.body.page});
    });
  });
});
function getSalesPolicyDrugsSql(req){
  //药品连接政策
  var sql = "select * from drugs d left join sale_policy sp on d.product_id = sp.sale_drug_id "+
            " and (sp.sale_hospital_id = '"+req.body.data.hospitalId+"' or sp.sale_hospital_id is null) "+
            " where d.delete_flag='0' and d.group_id = '"+req.session.user[0].group_id+"' "+
            " and d.product_type in ('佣金','高打') and (sp.sale_policy_money is null or sp.sale_policy_money ='') ";
  if(req.body.data.productCommonName){
    sql += " and (d.product_common_name like '%"+req.body.data.productCommonName+"%' or d.product_name_pinyin like '%"+req.body.data.productCommonName+"%')";
  }
  if(req.body.data.productCode){
    sql += " and d.product_code = '"+req.body.data.productCode+"'";
  }
  //连接业务员
  sql = "select dsc.*,c.contacts_name from ("+sql+") dsc left join contacts c on dsc.sale_policy_contact_id = c.contacts_id";
  //连接销往单位
  sql = "select dsch.*,h.hospital_name from ("+sql+") dsch left join hospitals h on dsch.sale_hospital_id = h.hospital_id "
  //连接商业
  sql = "select * from ("+sql+") dsp left join business b on dsp.product_business = b.business_id";
  return sql;
}
module.exports = router;
