var express = require("express");
var nodeExcel = require('excel-export');
var logger = require('../utils/logger');
var fs = require('fs');
var util= require('../utils/global_util.js');
var uuid=require("node-uuid");
var parse = require('csv-parse');
var XLSX = require("xlsx");
var router = express.Router();
//下载错误数据
router.get("/downloadErrorSales",function(req,res){
  var conf ={};
  conf.stylesXmlFile = "./utils/styles.xml";
  conf.name = "mysheet";
  conf.cols = [{caption:'销售日期',type:'string'
  },{caption:'产品编号',type:'string'
  },{caption:'销售单价',type:'number'
  },{caption:'销售数量',type:'number'
  },{caption:'批号',type:'string'
  },{caption:'该批号入库时间（高打品种必填）',type:'string'
  },{caption:'销往单位',type:'string'
  },{caption:'销售类型（1:销售出库；2:销售退回；3:销售退补价）',type:'string'
  },{caption:'错误信息',type:'string'
  }];
  var header = ['bill_date','product_code','sale_price','sale_num','batch_number','storage_time','hospital_name','sale_type','errorMessage'];
  var d = JSON.parse(req.session.errorSalesData);

  conf.rows = util.formatExcel(header,d);
  var result = nodeExcel.execute(conf);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats');
  res.setHeader("Content-Disposition", "attachment; filename=" + "error.xlsx");
  res.end(result, 'binary');
});
//导入销售记录
router.post("/importSales",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",102,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  if(!(req.files.file.path.split(".")[1] == "xls" || req.files.file.path.split(".")[1] == "xlsx")){
    res.json({"code":"111112",message:"<a style='color:red;'>文件格式错误</a>"});
    return ;
  }
  var workbook = XLSX.readFile(req.files.file.path);
  workbook.SheetNames.forEach(function (sheetName) {//excel工作表
    var csvdatas = XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName]);//获取单元格
    parse(csvdatas, function (err, output) {//解释成行数据
      if (err){
        return;
      }
      getSalesData(req,output).then(data=>{
        var salesData= verData(req,data);
        req.session.errorSalesData = null;
        req.session.errorSalesData = JSON.stringify(salesData.errData);//错误的数据
        var sData = salesData.correctData;//正确的数据
        var importMessage = "数据导入成功<a style='color:red;'>"+sData.length+"</a>条；导入错误<a style='color:red;'>"+salesData.errData.length+"</a>条；"
        if(sData.length<1){
          var message = req.session.user[0].realname+"导入销售记录，数据导入错误"+salesData.errData.length+"条；";
          util.saveLogs(req.session.user[0].group_id,"-","-",message);
          res.json({"code":"000000",message:importMessage});
          return;
        }
        //插入销售记录sql
        var sql = "insert into sales(sale_id,bill_date,sale_price,sale_num,batch_number,product_code,hospital_id,gross_profit,real_gross_profit,"+
                  "accounting_cost,cost_univalent,sale_return_flag,sale_tax_rate,group_id,sale_create_time,sale_create_userid,"+
                  "sale_type,sale_money,sale_return_money,sales_purchase_id,sale_return_price) VALUES ";
        //更新库存sql
        var updateStockSql = "insert into batch_stock(batch_stock_drug_id,batch_stock_purchase_id,batch_stock_number) values ";
        var updateFlag = false;//是否执行更新库存语句
        //新增返款流水和医院销售回款流水
        var bankDetailSql = "insert into bank_account_detail(account_detail_id,account_detail_deleta_flag,account_detail_group_id,"+
                            "flag_id,account_detail_create_time,account_detail_create_userid) VALUES ";
        var bankDetailSqlValue="";
        //新增返款记录sql
        var refundSql = "insert into refunds(refunds_id,refund_create_time,refund_create_userid,sales_id,refunds_should_money,"+
                        "refunds_should_time,refunds_policy_money) VALUES ";
        var refundSqlValue = "";
        var batchStockOject={};//记录批次库存
        for(var i = 0 ; i < sData.length;i++){
          var groupId = req.session.user[0].group_id;
          var createTime = new Date().format('yyyy-MM-dd');
          var createUserId = req.session.user[0].id;
          sData[i].sale_id = uuid.v1();
          //批量插入销售记录拼接sql
          sql+="('"+sData[i].sale_id+"','"+sData[i].bill_date+"','"+sData[i].sale_price+"','"+sData[i].sale_num+"','"+sData[i].batch_number+"','"+sData[i].product_code+"',"+
               "'"+sData[i].hospital_id+"','"+sData[i].gross_profit+"','"+sData[i].real_gross_profit+"','"+sData[i].accounting_cost+"',"+
               "'"+sData[i].cost_univalent+"','"+sData[i].sale_return_flag+"','"+sData[i].sale_tax_rate+"','"+sData[i].group_id+"',"+
               "'"+createTime+"','"+sData[i].sale_create_userid+"','"+sData[i].sale_type+"','"+sData[i].sale_money+"','"+sData[i].sale_return_money+"',"+
               "'"+sData[i].sales_purchase_id+"','"+sData[i].sale_policy_money+"'),";
          if(sData[i].product_type == '高打'){//更新库存，sql语句拼接
            updateFlag = true;
            var key = sData[i].product_id+"--"+sData[i].sales_purchase_id;
            batchStockOject[key]=batchStockOject[key]?batchStockOject[key]-sData[i].sale_num:sData[i].stock-sData[i].sale_num;
          }
          if(sData[i].product_type == '佣金'){//添加佣金返款流水    返款记录
            bankDetailSqlValue+="('"+uuid.v1()+"','1','"+groupId+"','sale_"+sData[i].sale_id+"','"+createTime+"','"+createUserId+"'),";
            var srm = "";
            if(sData[i].product_return_money){//应返金额
              srm = util.mul(sData[i].product_return_money,sData[i].sale_num,2);
            }
            var rst = util.getReturnTime(new Date(sData[i].bill_date),sData[i].product_return_time_type,sData[i].product_return_time_day,sData[i].product_return_time_day_num);
            refundSqlValue+="('"+uuid.v1()+"','"+createTime+"','"+createUserId+"','"+sData[i].sale_id+"','"+srm+"','"+rst.format("yyyy-MM-dd")+"','"+sData[i].product_return_money+"'),";
          }
          if(sData[i].product_type == '佣金' || sData[i].product_type == '高打'){//添加销售医院流水
            bankDetailSqlValue+="('"+uuid.v1()+"','1','"+groupId+"','sale_hospital_"+sData[i].sale_id+"','"+createTime+"','"+createUserId+"'),";
          }
        }
        for(var k in batchStockOject){
          var id = k.split("--");
          updateStockSql+="('"+id[0]+"','"+id[1]+"','"+batchStockOject[k]+"'),";
        }
        updateStockSql = updateStockSql.substring(0,updateStockSql.length-1);
        updateStockSql += " ON DUPLICATE KEY UPDATE batch_stock_number=VALUES(batch_stock_number);";
        sql = sql.substring(0,sql.length-1);//插入销售sql
        bankDetailSql = bankDetailSql+bankDetailSqlValue.substring(0,bankDetailSqlValue.length-1);//插入流水账sql
        refundSql = refundSql+refundSqlValue.substring(0,refundSqlValue.length-1);//批量添加销售记录
        var sales = DB.get("Sales");
        sales.executeSql(sql,function(err,result){//批量添加销售记录
          if(err){
            logger.error(req.session.user[0].realname + "批量插入销售记录出错" + err);
          }
          var message = req.session.user[0].realname+"导入销售记录，数据导入成功"+sData.length+"条；导入错误"+salesData.errData.length+"条；";
          util.saveLogs(req.session.user[0].group_id,"-","-",message);
          if(updateFlag){
            sales.executeSql(updateStockSql,function(err,result){//更新库存
              if(err){
                logger.error(req.session.user[0].realname + "批量插入销售记录，更新库存出错" + err);
              }
            });
          }
          if(bankDetailSqlValue){
            sales.executeSql(bankDetailSql,function(err,result){//插入流水账sql
              if(err){
                logger.error(req.session.user[0].realname + "批量插入销售记录，批量添加流水账出错出错" + err);
              }
            });
          }
          if(refundSqlValue){
            sales.executeSql(refundSql,function(err,result){//插入返款记录
              if(err){
                logger.error(req.session.user[0].realname + "批量插入销售记录，批量添加返款记录出错" + err);
              }
            });
          }
          res.json({"code":"000000",message:importMessage});
        });
      });
    });
  });
});
//检验格式是否正确
function verData(req,data){
  var correctData=[];
  var errData=[];
  var batchStock = data.batchStock;
  var sales = data.salesDrugsData;
  for(var i = 0 ;i < sales.length;i++){
    //非空验证
    var d = {};
    d.bill_date = sales[i].bill_date;
    d.sale_price = sales[i].sale_price;
    d.sale_num = sales[i].sale_num;
    d.hospital_id = sales[i].hospital_id;
    d.product_id = sales[i].product_id;
    d.sale_type = sales[i].sale_type;
    d.hospital_name = sales[i].hospital_name;
    d.product_code = sales[i].product_code;
    d.batch_number = sales[i].batch_number;
    d.product_type = sales[i].product_type;
    d.storage_time = sales[i].storage_time;
    d.bill_date = new Date(d.bill_date).format('yyyy-MM-dd');
    if(!d.bill_date || !d.sale_price ||!d.sale_num ||!d.hospital_name ||!d.product_code||!d.sale_type){
      d.errorMessage = "销售日期、产品编号、销售单价、销售数量、销往单位、销售类型为必填项";
      errData.push(d);
      continue;
    }
    if(d.product_type == "高打" && !d.batch_number){
      d.errorMessage = "高打品种，批号必填";
      errData.push(d);
      continue;
    }
    if(d.product_type == "高打" && !d.storage_time){
      d.errorMessage = "高打品种，该批号入库时间必填";
      errData.push(d);
      continue;
    }
    if(d.storage_time){
      d.storage_time = new Date(d.storage_time).format("yyyy-MM-dd");
    }
    for(var j = 0 ; j < batchStock.length ;j++){//如果遇到相同批号的情况，则取最近的一条
      var t = new Date(batchStock[j].batch_stock_time).format("yyyy-MM-dd");
      if(batchStock[j].batch_number == d.batch_number && d.storage_time == t){
        d.sales_purchase_id = batchStock[j].batch_stock_purchase_id;
        d.stock = batchStock[j].batch_stock_number;
        d.sale_other_money_temp = batchStock[j].purchase_other_money?batchStock[j].purchase_other_money*d.sale_num/batchStock[j].purchase_number:0;
        d.batch_number = d.batch_number + "("+d.storage_time+")";
        break;
      }
    }
    if(d.product_type == "高打" && !d.sales_purchase_id){
      d.errorMessage = "当前入库时间，无该批号或该批号无库存";
      errData.push(d);
      continue;
    }
    //验证价格
    var moneyReg = /^(([1-9]\d+(.[0-9]{1,})?|\d(.[0-9]{1,})?)|([-]([1-9]\d+(.[0-9]{1,})?|\d(.[0-9]{1,})?)))$/;
    if(!moneyReg.test(d.sale_price)){
      d.errorMessage = "销售单价填写错误";
      errData.push(d);
      continue;
    }
    //验证价格是否为正确的数字
    var moneyReg = /^(0|[1-9][0-9]*|-[1-9][0-9]*)$/;
    if( (d.sale_num && !moneyReg.test(d.sale_num))){
      d.errorMessage = "销售数量填写错误";
      errData.push(d);
      continue;
    }
    //验证编码是否存在
    if(!d.hospital_id){
      d.errorMessage = "销售单位不存在";
      errData.push(d);
      continue;
    }
    //验证编码是否存在
    if(!d.product_id){
      d.errorMessage = "产品编码不存在";
      errData.push(d);
      continue;
    }
    //返款统计为1 2 3
    if(!(d.sale_type=='1'||d.sale_type=='2'||d.sale_type=='3')){
      d.errorMessage = "销售类型1/2/3（1:销售出库；2:销售退回；3:销售退补价）";
      errData.push(d);
      continue;
    }
    d.hospital_id = sales[i].hospital_id;
    d.gross_profit = 0;//毛利
    d.real_gross_profit= 0;//真实毛利
    if(sales[i].product_mack_price){
      d.gross_profit = util.mul(d.sale_num,util.sub(d.sale_price,sales[i].product_mack_price),2);
    }
    if(sales[i].accounting_cost){
      d.real_gross_profit = util.mul(d.sale_num,util.sub(d.sale_price,sales[i].accounting_cost),2);
    }
    d.sale_money = util.mul(d.sale_num,d.sale_price,2);
    d.accounting_cost = sales[i].accounting_cost?sales[i].accounting_cost:"";
    d.cost_univalent = sales[i].product_mack_price?sales[i].product_mack_price:"";
    d.product_id = sales[i].product_id;
    d.sale_return_flag = sales[i].product_return_statistics;
    d.product_return_time_type = sales[i].product_return_time_type;
    d.product_return_time_day = sales[i].product_return_time_day;
    d.product_return_time_day_num = sales[i].product_return_time_day_num;
    d.sale_tax_rate = sales[i].product_tax_rate;
    d.sale_type = sales[i].sale_type;
    d.product_return_money = sales[i].product_return_money;
    d.group_id = req.session.user[0].group_id;
    d.sale_create_time = new Date().format('yyyy-MM-dd hh:mm:ss');
    d.sale_create_userid = req.session.user[0].id;
    d.sale_policy_money = sales[i].sale_policy_money?sales[i].sale_policy_money:"";
    d.sale_return_money = sales[i].sale_policy_money?util.mul(d.sale_num,sales[i].sale_policy_money):"";
    d.sale_return_money = util.sub(d.sale_return_money,d.sale_other_money_temp,2);

    correctData.push(d);
  }
  return {
    correctData:correctData,
    errData:errData
  };
}
//根据上传的药品编码，查询药品信息。根据上传的销售单位名称，查询销售单位id
function getSalesData(req,sales){
  //去空格处理
  var pdCode = "";
  for(var i = 1 ; i < sales.length;i++){
    pdCode+="\'"+sales[i][1]+"\',"
    for(var j = 0 ;j<sales[i].length ;j++){
      sales[i][j] = sales[i][j].trim();
    }
  }
  pdCode = pdCode.substring(0,pdCode.length-1);
  //拼接上传的产品编码，查询所有编码的药品
  var drugsSql = "select * from drugs d where d.delete_flag = '0' and d.group_id = '"+req.session.user[0].group_id+"' "+
                 "and d.product_code in ("+pdCode+")";
  var drugs = DB.get("Drugs");
  return new Promise((resolve, reject) => {//查询所有药品编码{
    drugs.executeSql(drugsSql,function(err,result){
      if(err){
        logger.error(req.session.user[0].realname + "导入销售记录，查询药品出错" + err);
         reject(err);
      }else{
        //将上传的数据，封闭成对象
        var salesDrugsData=[];
        for(var i = 1 ;i < sales.length;i++){
          var d = arrayToObject(sales[i]);
          var f = true;
          for(var j = 0 ; j<result.length;j++){
            if(d.product_code == result[j].product_code){
              result[j].bill_date=d.bill_date;
              result[j].sale_price=d.sale_price;
              result[j].sale_num=d.sale_num;
              result[j].sale_type=d.sale_type;
              result[j].hospital_name=d.hospital_name;
              result[j].batch_number = d.batch_number;
              result[j].storage_time = d.storage_time;
              var temp = JSON.stringify(result[j]);
              salesDrugsData.push(JSON.parse(temp));
              f = false;
            }
          }
          if(f){
            salesDrugsData.push(d);
          }
        }
        resolve(salesDrugsData);
      }
    });
  }).then(salesDrugsData => {
    return new Promise((resolve, reject) => {
      var hospitals = DB.get("Hospitals");
      var sql = "select * from hospitals h where h.group_id = '"+req.session.user[0].group_id+"' and h.delete_flag = '0' "+
                "and h.hospital_type like '%销售单位%'";
      hospitals.executeSql(sql,function(err,result){
        if(err){
          logger.error(req.session.user[0].realname + "导入销售数据，查询销售医院出错" + err);
          reject(err);
        }else{
          var hospitalId = "";
          for(var i = 0 ; i < salesDrugsData.length;i++){
            for(var j = 0 ;j < result.length;j++){
              if(salesDrugsData[i].hospital_name == result[j].hospital_name){
                hospitalId+="\'"+result[j].hospital_id+"\',";
                salesDrugsData[i].hospital_id = result[j].hospital_id;
              }
            }
          }
          resolve({salesDrugsData:salesDrugsData,hospitalId:hospitalId});
        }
      });
    });
  }).then(data=>{//查询调货政策
    return new Promise((resolve, reject) => {
      data.hospitalId=data.hospitalId.substring(0,data.hospitalId.length-1);
      var sql = "select * from sale_policy ap where ap.sale_hospital_id in ("+data.hospitalId+")";
      if(data.hospitalId){
        drugs.executeSql(sql,function(err,result){
          if(err){
            logger.error(req.session.user[0].realname + "导入销售数据，查询销售政策出错" + err);
            reject(err);
          }else{
            for(var i = 0 ; i < data.salesDrugsData.length;i++){
              for(var j = 0 ;j < result.length;j++){
                if(data.salesDrugsData[i].hospital_id == result[j].sale_hospital_id &&
                   data.salesDrugsData[i].product_id == result[j].sale_drug_id){
                   data.salesDrugsData[i].sale_policy_money = result[j].sale_policy_money;
                   data.salesDrugsData[i].sale_policy_contact_id = result[j].sale_policy_contact_id;
                }
              }
            }
            resolve(data);
          }
        });
      }else{
        resolve(data);
      }
    });
  }).then(data=>{//查询调货政策
    return new Promise((resolve, reject) => {
      var sql = "select * from hospital_policy_record ap where ap.hospital_policy_group_id = '"+req.session.user[0].group_id+"' and ap.hospital_policy_delete_flag = '0' ";
      drugs.executeSql(sql,function(err,result){
        if(err){
          logger.error(req.session.user[0].realname + "导入销售数据，查询上游特殊政策出错" + err);
          reject(err);
        }else{
          for(var i = 0 ; i < data.salesDrugsData.length;i++){
            for(var j = 0 ;j < result.length;j++){
              if(data.salesDrugsData[i].hospital_id == result[j].hospital_policy_hospital_id &&
                 data.salesDrugsData[i].product_id == result[j].hospital_policy_drug_id && result[j].hospital_policy_return_money){
                 data.salesDrugsData[i].product_return_money=result[j].hospital_policy_return_money;
              }
            }
          }
          resolve(data);
        }
      });
    });
  }).then(data=>{//查询批次库存
    return new Promise((resolve, reject) => {
      var batchStock = DB.get("BatchStock");
      var sql = "select bs.*,p.purchase_number,p.purchase_other_money from batch_stock bs left join purchase p on bs.batch_stock_purchase_id = p.purchase_id "+
                "where  bs.tag_type_delete_flag = '0' and bs.tag_type_group_id = '"+req.session.user[0].group_id+"' "+
                "and bs.batch_stock_number > 0 and p.delete_flag = '0' and p.group_id = '"+req.session.user[0].group_id+"' ";
      batchStock.executeSql(sql,function(err,result){
        if(err){
          logger.error(req.session.user[0].realname + "由药品id，查询批次库存出错" + err);
        }
        data.batchStock = result;
        resolve(data);
      });
    });
  });
}
//将数组转成对象
function arrayToObject(sales){
  return {
    bill_date:sales[0],
    product_code:sales[1],
    sale_price:sales[2],
    sale_num:sales[3],
    batch_number:sales[4],
    storage_time:sales[5],
    hospital_name:sales[6],
    sale_type:sales[7]
  }
}
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
//导出销售记录
router.post("/exportSales",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",52,") < 0){
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
    },{caption:'商业',type:'string'
    },{caption:'中标价',type:'number'
    },{caption:'购入金额',type:'number'
    }];
    var header = ['bill_date', 'hospital_name', 'product_code', 'product_common_name', 'product_specifications','product_makesmakers','product_unit','sale_num','business_name','sale_price','sale_money'];
    conf.rows = util.formatExcel(header,result);
    var result = nodeExcel.execute(conf);
    var message = req.session.user[0].realname+"导出销售记录。"+conf.rows.length+"条";
    util.saveLogs(req.session.user[0].group_id,"-",findParam,message);
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
  if(req.session.user[0].authority_code.indexOf(",48,") < 0){
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
  if(req.body.sale_return_price){//销售回款金额
    req.body.sale_return_money=util.mul(req.body.sale_return_price,req.body.sale_num);
    req.body.sale_other_money = req.body.sale_other_money?req.body.sale_other_money:0;
    req.body.sale_return_money=util.sub(req.body.sale_return_money,req.body.sale_other_money,2);
  }
  var returnTime={
    product_return_time_type:req.body.product_return_time_type,
    product_return_time_day:req.body.product_return_time_day,
    product_return_time_day_num:req.body.product_return_time_day_num
  }
  req.body.sale_create_time = new Date();
  req.body.sale_create_userid = req.session.user[0].id;
  sales.insert(req.body,'sale_id',function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "新增销售记录出错" + err);
    }
    var message = req.session.user[0].realname+"新增销售记录。id："+result;
    util.saveLogs(req.session.user[0].group_id,"-",JSON.stringify(req.body),message);
    //新增流水   新增返款记录
    saveSaleHospitalAccountDetail(req,result);
    if(productType == '佣金'){
      saveRefundsSale(req,productReturnMoney,result,returnTime,productType);
    }
    res.json({"code":"000000",message:result});
  });
  //添加完销售记录后，更新库存。
  if(productType == '高打'){
    var batchStock = DB.get("BatchStock");
    var sql = "update batch_stock set batch_stock_number=batch_stock_number-"+req.body.sale_num+" where "+
              "batch_stock_purchase_id='"+req.body.sales_purchase_id+"' and batch_stock_drug_id='"+productId+"'";
    batchStock.executeSql(sql,function(err,result){
      if(err){
        logger.error(req.session.user[0].realname + "销售高打品种，更新库存出错" + err);
      }
    });
  }
});
//新增 返款记录
function saveRefundsSale(req,productReturnMoney,id,returnTime,productType){
  //新增返款记录  并保存应返金额
  var rst = util.getReturnTime(new Date(req.body.bill_date),returnTime.product_return_time_type,returnTime.product_return_time_day,returnTime.product_return_time_day_num);
  var m = {
    refund_create_time:new Date(),
    refund_create_userid:req.session.user[0].id,
    refunds_should_time:rst.format("yyyy-MM-dd"),
    refunds_policy_money:productReturnMoney,
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

  //保存返款流水，如果保存时，还没有返款或者没有添加收款信息，则标识为删除
  var bankaccountdetail={};
  if(!req.body.receiver){
    bankaccountdetail.account_detail_deleta_flag = '1';
  }else{
    bankaccountdetail.account_id = req.body.receiver;
  }
  bankaccountdetail.account_detail_group_id = req.session.user[0].group_id;
  bankaccountdetail.flag_id = "sale_"+id;
  bankaccountdetail.account_detail_create_time = new Date();
  bankaccountdetail.account_detail_create_userid = req.session.user[0].id;
  var accountDetail = DB.get("AccountDetail");
  accountDetail.insert(bankaccountdetail,'account_detail_id',function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "添加返款新增流水出错" + err);
    }
  });
}
//插入一条流水账记录
function saveSaleHospitalAccountDetail(req,id){
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
      sale_other_money:req.body.sale_other_money

    }
    var t = req.body.sale_return_price?req.body.sale_return_price:req.body.sale_policy_money;
    t = t?t:0;
    if(req.body.sale_return_real_return_money){
      params.sale_return_real_return_money=req.body.sale_return_real_return_money;
    }
    params.sale_return_money = util.mul(t,req.body.sale_num);
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
    var front_sale = req.body.front_sale;
    sales.update(params,'sale_id',function(err,result){
      if(err){
        logger.error(req.session.user[0].realname + "修改销售出错" + err);
      }
      var message = req.session.user[0].realname+"修改销售记录。";
      util.saveLogs(req.session.user[0].group_id,front_sale,JSON.stringify(params),message);
      //销售回款时，更新政策
      // updateSalePolicy(req);
      //更新返款金额
      updateRefundsSale(req);
      updateAllotAccountDetail(req);
      res.json({"code":"000000",message:null});
    });

    //添加完销售记录后，更新库存。
    if(req.body.product_type == '高打'){
      var stock = req.body.sale_num - parseInt(req.body.sale_num_temp);
      var batchStock = DB.get("BatchStock");
      var sql = "update batch_stock set batch_stock_number=batch_stock_number-"+stock+" where "+
                "batch_stock_purchase_id='"+req.body.sales_purchase_id+"' and batch_stock_drug_id='"+req.body.product_id+"'";
      batchStock.executeSql(sql,function(err,result){
        if(err){
          logger.error(req.session.user[0].realname + "销售高打品种，更新库存出错" + err);
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
//删除联系人
router.post("/deleteSales",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",50,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var sales = DB.get("Sales");
  req.body.delete_flag = 1;
  var productType = req.body.product_type;
  var stock = parseInt(req.body.stock);
  var productId = req.body.product_id;
  var saleNum = parseInt(req.body.sale_num);
  sales.update(req.body,'sale_id',function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "删除销售出错" + err);
    }
    var message = req.session.user[0].realname+"删除销售记录。id："+req.body.sale_id;
    util.saveLogs(req.session.user[0].group_id,"-","-",message);
    res.json({"code":"000000",message:null});
  });

  //删除完销售记录后，更新库存。
  if(productType == '高打'){
    var batchStock = DB.get("BatchStock");
    var sql = "update batch_stock set batch_stock_number=batch_stock_number+"+saleNum+" where "+
              "batch_stock_purchase_id='"+req.body.sales_purchase_id+"' and batch_stock_drug_id='"+productId+"'";
    batchStock.executeSql(sql,function(err,result){
      if(err){
        logger.error(req.session.user[0].realname + "删除高打品种，更新库存出错" + err);
      }
    });
  }
});
//查询销售记录
router.post("/getSales",function(req,res){
  var noDate = new Date();
  if(req.session.user[0].authority_code.indexOf(",51,") > 0 || req.session.user[0].authority_code.indexOf(",127,") > 0){
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
        req.body.page.saleMoney = money && money[0].saleMoney?Math.round(money[0].saleMoney*100)/100:0;
        req.body.page.realGrossProfit = money && money[0].realGrossProfit?Math.round(money[0].realGrossProfit*100)/100:0;
        req.body.page.grossProfit = money && money[0].grossProfit?Math.round(money[0].grossProfit*100)/100:0;
        req.body.page.saleReturnMoney = money && money[0].saleReturnMoney?Math.round(money[0].saleReturnMoney*100)/100:0;
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
            "s.sale_account_name,s.sale_account_number,s.sale_account_address,s.batch_number,s.sales_purchase_id,s.sale_other_money,"+
            "s.sale_return_time,s.sale_account_id,sp.sale_policy_remark,sp.sale_policy_money,sp.sale_policy_contact_id,"+
            "s.cost_univalent,bus.business_name,s.hospital_id,h.hospital_name,d.product_id,d.stock,d.product_type,d.buyer,d.product_business,"+
            "s.sale_return_price,s.sale_contact_id,d.product_common_name,d.product_specifications,s.sale_return_money,"+
            "d.product_makesmakers,d.product_unit,d.product_packing,d.product_return_money,d.product_code,c.contacts_name,td.tag_ids,p.purchase_number,p.purchase_other_money "+
            "from sales s "+
            "left join drugs d on s.product_code = d.product_code ";
  // if(req.body.data.tag && req.body.data.tag != 'undefined'){
    var tagSql = "select tagd.drug_id,concat(GROUP_CONCAT(tagd.tag_id),',') tag_ids from tag_drug tagd "+
                 "where tagd.tag_drug_deleta_flag = '0' and tagd.tag_drug_group_id = '"+req.session.user[0].group_id+"' group by tagd.drug_id ";
    sql+="left join ("+tagSql+") td on d.product_id = td.drug_id ";
  // }
  sql +="left join sale_policy sp on s.hospital_id = sp.sale_hospital_id and d.product_id = sp.sale_drug_id ";
  sql +="left join business bus on d.product_business = bus.business_id "+
        "left join hospitals h on s.hospital_id = h.hospital_id "+
        "left join contacts c on c.contacts_id = d.contacts_id "+
        "left join purchase p on p.purchase_id = s.sales_purchase_id "+
        "where s.delete_flag = '0' and s.group_id = '"+req.session.user[0].group_id+"' "+
        "and d.delete_flag = '0' and d.group_id = '"+req.session.user[0].group_id+"' ";
  //数据权限
  if(req.session.user[0].data_authority == "2"){
    sql += "and s.sale_create_userid = '"+req.session.user[0].id+"'";
  }
  if(req.body.data.tag && req.body.data.tag != 'undefined'){
    sql += "and td.tag_ids like '%"+req.body.data.tag+",%'"
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
  if(req.body.data.salesReturnFlag){
    sql += " and sp.sale_policy_money is not null and sp.sale_policy_money !=''";
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
