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
  },{caption:'销售单价',type:'string'
  },{caption:'销售数量',type:'string'
  },{caption:'销往单位',type:'string'
  },{caption:'销售类型（1:销售出库；2:销售退回；3:销售退补价）',type:'string'
  },{caption:'错误信息',type:'string'
  }];
  var header = ['bill_date','product_code','sale_price','sale_num','hospital_name','sale_type','errorMessage'];
  var d = JSON.parse(req.session.errorSalesData);
  conf.rows = util.formatExcel(header,d);
  var result = nodeExcel.execute(conf);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats');
  res.setHeader("Content-Disposition", "attachment; filename=" + "error.xlsx");
  res.end(result, 'binary');
});
//导入销售记录
router.post("/importSales",function(req,res){
  if(req.session.user[0].authority_code.indexOf("102") < 0){
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
      getSalesData(req,output).then(salesDrugsData=>{
        var salesData= verData(req,salesDrugsData);
        req.session.errorSalesData = JSON.stringify(salesData.errData);//错误的数据
        var sData = salesData.correctData;//正确的数据
        var importMessage = "数据导入成功<a style='color:red;'>"+sData.length+"</a>条；导入错误<a style='color:red;'>"+salesData.errData.length+"</a>条；"
        if(sData.length<1){
          res.json({"code":"000000",message:importMessage});
          return;
        }
        //插入销售记录sql
        var sql = "insert into sales(sale_id,bill_date,sale_price,sale_num,product_code,hospital_id,gross_profit,real_gross_profit,"+
                  "accounting_cost,cost_univalent,sale_return_flag,sale_tax_rate,group_id,sale_create_time,sale_create_userid,"+
                  "sale_type,sale_money,sale_return_money) VALUES ";
        //更新库存sql
        var updateStockSql = "update drugs d set d.stock = CASE d.product_id ";
        var updateProductId = "";
        //新增返款流水和医院销售回款流水
        var bankDetailSql = "insert into bank_account_detail(account_detail_id,account_detail_deleta_flag,account_detail_group_id,"+
                            "flag_id,account_detail_create_time,account_detail_create_userid) VALUES ";
        var bankDetailSqlValue="";
        //新增返款记录sql
        var refundSql = "insert into refunds(refunds_id,refund_create_time,refund_create_userid,sales_id,refunds_should_money,"+
                        "refunds_should_time) VALUES ";
        var refundSqlValue = "";
        for(var i = 0 ; i < sData.length;i++){
          var groupId = req.session.user[0].group_id;
          var createTime = new Date().format('yyyy-MM-dd');
          var createUserId = req.session.user[0].id;
          sData[i].sale_id = uuid.v1();
          //批量插入销售记录拼接sql
          sql+="('"+sData[i].sale_id+"','"+sData[i].bill_date+"','"+sData[i].sale_price+"','"+sData[i].sale_num+"','"+sData[i].product_code+"',"+
               "'"+sData[i].hospital_id+"','"+sData[i].gross_profit+"','"+sData[i].real_gross_profit+"','"+sData[i].accounting_cost+"',"+
               "'"+sData[i].cost_univalent+"','"+sData[i].sale_return_flag+"','"+sData[i].sale_tax_rate+"','"+sData[i].group_id+"',"+
               "'"+createTime+"','"+sData[i].sale_create_userid+"','"+sData[i].sale_type+"','"+sData[i].sale_money+"','"+sData[i].sale_return_money+"'),";
          if(sData[i].product_type == '高打'){//更新库存，sql语句拼接
            var tempStock = sData[i].stock-sData[i].sale_num;
            updateProductId += "'"+sData[i].product_id+"',";
            updateStockSql+=" when '"+sData[i].product_id+"' then '"+tempStock+"' ";
          }
          if(sData[i].product_type == '佣金'){//添加佣金返款流水    返款记录
            bankDetailSqlValue+="('"+uuid.v1()+"','1','"+groupId+"','sale_"+sData[i].sale_id+"','"+createTime+"','"+createUserId+"'),";
            var srm = "";
            if(sData[i].product_return_money){//应返金额
              srm = util.mul(sData[i].product_return_money,sData[i].sale_num,2);
            }
            var rst = util.getReturnTime(new Date(sData[i].bill_date),sData[i].product_return_time_type,sData[i].product_return_time_day,sData[i].product_return_time_day_num);
            refundSqlValue+="('"+uuid.v1()+"','"+createTime+"','"+createUserId+"','"+sData[i].sale_id+"','"+srm+"','"+rst.format("yyyy-MM-dd")+"'),";
          }
          if(sData[i].product_type == '佣金' || sData[i].product_type == '高打'){//添加销售医院流水
            bankDetailSqlValue+="('"+uuid.v1()+"','1','"+groupId+"','sale_hospital_"+sData[i].sale_id+"','"+createTime+"','"+createUserId+"'),";
          }
        }
        updateProductId=updateProductId.substring(0,updateProductId.length-1);
        updateStockSql += "end where d.product_id in ("+updateProductId+")";
        sql = sql.substring(0,sql.length-1);//插入销售sql
        bankDetailSql = bankDetailSql+bankDetailSqlValue.substring(0,bankDetailSql.length-1);//插入流水账sql
        refundSql = refundSql+refundSqlValue.substring(0,refundSql.length-1);//批量添加销售记录
        var sales = DB.get("Sales");
        sales.executeSql(sql,function(err,result){//批量添加销售记录
          if(err){
            logger.error(req.session.user[0].realname + "批量插入销售记录出错" + err);
          }
          if(updateProductId){
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
function verData(req,sales){
  var correctData=[];
  var errData=[];
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
    if(!d.bill_date || !d.sale_price ||!d.sale_num ||!d.hospital_name ||!d.product_code||!d.sale_type){
      d.errorMessage = "销售日期、产品编号、销售单价、销售数量、销往单位、销售类型为必填项";
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
    d.accounting_cost = sales[i].accounting_cost;
    d.cost_univalent = sales[i].product_mack_price;
    d.product_type = sales[i].product_type;
    d.product_id = sales[i].product_id;
    d.sale_return_flag = sales[i].product_return_statistics;
    d.product_return_time_type = sales[i].product_return_time_type;
    d.product_return_time_day = sales[i].product_return_time_day;
    d.product_return_time_day_num = sales[i].product_return_time_day_num;
    d.stock = sales[i].stock;
    d.sale_tax_rate = sales[i].product_tax_rate;
    d.sale_type = sales[i].sale_type;
    d.product_return_money = sales[i].product_return_money;
    d.group_id = req.session.user[0].group_id;
    d.bill_date = new Date(d.bill_date).format('yyyy-MM-dd');
    d.sale_create_time = new Date().format('yyyy-MM-dd');
    d.sale_create_userid = req.session.user[0].id;
    d.sale_return_money = sales[i].sale_policy_money?util.mul(d.sale_num,sales[i].sale_policy_money,2):"";
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
          for(var j = 0 ; j<result.length;j++){
            if(d.product_code == result[j].product_code){
              result[j].bill_date=d.bill_date;
              result[j].sale_price=d.sale_price;
              result[j].sale_num=d.sale_num;
              result[j].sale_type=d.sale_type;
              result[j].hospital_name=d.hospital_name;
              var temp = JSON.stringify(result[j]);
              salesDrugsData.push(JSON.parse(temp));
            }
          }
        }
        resolve(salesDrugsData);
      }
    });
  }).then(salesDrugsData => {
    return new Promise((resolve, reject) => {
      var hospitals = DB.get("Hospitals");
      hospitals.where({//查询医院id
        group_id:req.session.user[0].group_id,
        delete_flag:0,
        hospital_type:'销售医院'
      },function(err,result){
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
    if(data.hospitalId){
      return new Promise((resolve, reject) => {
        data.hospitalId=data.hospitalId.substring(0,data.hospitalId.length-1);
        var sql = "select * from sale_policy ap where ap.sale_hospital_id in ("+data.hospitalId+")";
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
            resolve(data.salesDrugsData);
          }
        });
      });
    }else{
      resolve(data.salesDrugsData);
    }
  });
}
//将数组转成对象
function arrayToObject(sales){
  return {
    bill_date:sales[0],
    product_code:sales[1],
    sale_price:sales[2],
    sale_num:sales[3],
    hospital_name:sales[4],
    sale_type:sales[5]
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
//导出回款记录
router.post("/exportSalesRefund",function(req,res){
  if(req.session.user[0].authority_code.indexOf("e430d5a0-d802-11e8-a19c-cf0f6be47d2e") < 0){
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
    //新增流水   新增返款记录
    saveSaleHospitalAccountDetail(req,result);
    if(productType == '佣金'){
      saveRefundsSale(req,productReturnMoney,result,returnTime);
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
function saveRefundsSale(req,productReturnMoney,id,returnTime){
  //新增返款记录  并保存应返金额
  var rst = util.getReturnTime(new Date(req.body.bill_date),returnTime.product_return_time_type,returnTime.product_return_time_day,returnTime.product_return_time_day_num);
  var m = {
    refund_create_time:new Date(),
    refund_create_userid:req.session.user[0].id,
    refunds_should_time:rst.format("yyyy-MM-dd"),
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
  		bill_date:req.body.bill_date,
  		hospital_id:req.body.hospital_id,
      sale_account_id:req.body.sale_account_id,
      sale_return_money:req.body.sale_return_money,
      sale_return_price:req.body.sale_return_price,
      sale_contact_id:req.body.sale_contact_id,
      sale_type:req.body.sale_type,
      sale_account_name:req.body.sale_account_name,
      sale_account_number:req.body.sale_account_number,
      sale_account_address:req.body.sale_account_address
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
  var noDate = new Date();
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
            "s.sale_account_name,s.sale_account_number,s.sale_account_address,"+
            "s.sale_return_time,s.sale_account_id,sp.sale_policy_remark,sp.sale_policy_money,sp.sale_policy_contact_id,"+
            "s.cost_univalent,bus.business_name,s.hospital_id,h.hospital_name,d.product_id,d.stock,d.product_type,d.buyer,d.product_business,"+
            "s.sale_return_price,s.sale_contact_id,d.product_common_name,d.product_specifications,s.sale_return_money,"+
            "d.product_makesmakers,d.product_unit,d.product_packing,d.product_return_money,d.product_code "+
            "from sales s "+
            "left join drugs d on s.product_code = d.product_code ";
  if(req.body.data.tag){
    sql+="left join tag_drug td on d.product_id = td.drug_id ";
  }
  sql +="left join sale_policy sp on s.hospital_id = sp.sale_hospital_id and d.product_id = sp.sale_drug_id ";
  sql +="left join business bus on d.product_business = bus.business_id "+
        "left join hospitals h on s.hospital_id = h.hospital_id "+
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
  if(req.body.data.tag){
    sql += " and td.tag_id = '"+req.body.data.tag+"'";
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
