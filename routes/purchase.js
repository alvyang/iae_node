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
router.get("/downloadErrorPurchases",function(req,res){
  var conf ={};
  conf.stylesXmlFile = "./utils/styles.xml";
  conf.name = "mysheet";
  conf.cols = [{caption:'备货日期',type:'string',
  beforeCellWrite:function(row, cellData){
    return new Date(cellData).format('yyyy-MM-dd');
  }
  },{caption:'产品编号',type:'string'
  },{caption:'备货单价',type:'number'
  },{caption:'备货数量',type:'number'
  },{caption:'补点/费用票',type:'number'
  },{caption:'打款时间',type:'string',
  beforeCellWrite:function(row, cellData){
    return new Date(cellData).format('yyyy-MM-dd');
  }
  },{caption:'发货时间',type:'string',
  beforeCellWrite:function(row, cellData){
    return new Date(cellData).format('yyyy-MM-dd');
  }
  },{caption:'入库时间',type:'string',
  beforeCellWrite:function(row, cellData){
    return new Date(cellData).format('yyyy-MM-dd');
  }
  },{caption:'批号',type:'string'
  },{caption:'税票号',type:'string'
  },{caption:'错误信息',type:'string'
  }];
  var header = ['time','product_code','purchase_mack_price','purchase_number','purchase_other_money','make_money_time',
                'send_out_time','storage_time','batch_number','ticket_number','errorMessage'];
  var d = JSON.parse(req.session.errorSalesData);

  conf.rows = util.formatExcel(header,d);
  var result = nodeExcel.execute(conf);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats');
  res.setHeader("Content-Disposition", "attachment; filename=" + "error.xlsx");
  res.end(result, 'binary');
});
//导入采购记录
router.post("/importPurchases",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",143,") < 0){
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
      getPurchasesData(req,output).then(data=>{
        var purchasesData= verData(req,data);
        req.session.errorSalesData = null;
        req.session.errorSalesData = JSON.stringify(purchasesData.errData);//错误的数据
        var sData = purchasesData.correctData;//正确的数据
        var importMessage = "数据导入成功<a style='color:red;'>"+sData.length+"</a>条；导入错误<a style='color:red;'>"+purchasesData.errData.length+"</a>条；"
        if(sData.length<1){
          res.json({"code":"000000",message:importMessage});
          var message = req.session.user[0].realname+"导入采进记录，数据导入错误"+purchasesData.errData.length+"条；";
          util.saveLogs(req.session.user[0].group_id,"-","-",message);
          return;
        }
        //新增采购记录
        var sql = "insert into purchase(purchase_id,purchase_number,purchase_money,time,send_out_time,storage_time,make_money_time,"+
                  "group_id,drug_id,purchase_price,purchase_mack_price,puchase_gross_rate,purchase_return_flag,purchase_create_time,"+
                  "purchase_create_userid,batch_number,ticket_number,purchase_other_money) VALUES ";
        //新增返款记录sql
        var refundSql = "insert into refunds(refunds_id,refund_create_time,refund_create_userid,purchases_id,refunds_should_money,"+
                        "refunds_should_time,refunds_policy_money) VALUES ";
        var refundSqlValue = "";
        //新增返款流水和医院销售回款流水
        var bankDetailSql = "insert into bank_account_detail(account_detail_id,account_detail_deleta_flag,account_detail_group_id,"+
                            "flag_id,account_detail_create_time,account_detail_create_userid) VALUES ";
        var bankDetailSqlValue = "";
        var stockSql = "insert into batch_stock values ";
        var stockSqlFlag = false;
        for(var i = 0 ; i < sData.length ;i++){
          sData[i].purchases_id = uuid.v1();
          sql += "('"+sData[i].purchases_id +"','"+sData[i].purchase_number+"','"+sData[i].purchase_money+"','"+sData[i].time+"','"+sData[i].send_out_time+"',"+
                 "'"+sData[i].storage_time+"','"+sData[i].make_money_time+"','"+sData[i].group_id+"','"+sData[i].product_id+"','"+sData[i].purchase_price+"','"+sData[i].purchase_mack_price+"',"+
                 "'"+sData[i].puchase_gross_rate+"','"+sData[i].purchase_return_flag+"','"+sData[i].purchase_create_time+"','"+sData[i].purchase_create_userid+"',"+
                 "'"+sData[i].batch_number+"','"+sData[i].ticket_number+"','"+sData[i].purchase_other_money+"'),";

          refundSqlValue+="('"+uuid.v1()+"','"+sData[i].purchase_create_time+"','"+sData[i].purchase_create_userid+"','"+sData[i].purchases_id+"','"+sData[i].refunds_should_money+"','"+sData[i].refunds_should_time+"','"+sData[i].product_return_money+"'),";
          bankDetailSqlValue += "('"+uuid.v1()+"','1','"+sData[i].group_id+"','purchase_"+sData[i].purchases_id+"','"+sData[i].purchase_create_time+"','"+sData[i].purchase_create_userid+"'),";
          if(sData[i].storage_time){
            stockSql += "('"+sData[i].product_id+"','"+sData[i].purchases_id+"','"+sData[i].purchase_number+"','"+sData[i].storage_time+"','"+sData[i].batch_number+"','0','"+sData[i].group_id+"'),";
            stockSqlFlag = true;
          }
        }
        sql = sql.substring(0,sql.length-1);//插入销售sql
        refundSql = refundSql+refundSqlValue.substring(0,refundSqlValue.length-1);//批量添加销售记录
        bankDetailSql = bankDetailSql+bankDetailSqlValue.substring(0,bankDetailSqlValue.length-1);//插入流水账sql
        stockSql = stockSql.substring(0,stockSql.length-1);
        stockSql += " ON DUPLICATE KEY UPDATE batch_stock_number=VALUES(batch_stock_number),batch_number=VALUES(batch_number),batch_stock_time=VALUES(batch_stock_time);"
        var purchase = DB.get("Purchase");
        purchase.executeSql(sql,function(err,result){//批量添加销售记录
          if(err){
            logger.error(req.session.user[0].realname + "批量插入采购出错" + err);
          }else{
            if(stockSqlFlag){
              purchase.executeSql(stockSql,function(err,result){//插入返款记录
                if(err){
                  logger.error(req.session.user[0].realname + "批量插入销售记录，批量添加批次库存" + err);
                }
              });
            }
          }
          var message = req.session.user[0].realname+"导入采进记录，数据导入成功"+sData.length+"条；导入错误"+purchasesData.errData.length+"条；";
          util.saveLogs(req.session.user[0].group_id,"-","-",message);
          purchase.executeSql(refundSql,function(err,result){//更新库存
            if(err){
              logger.error(req.session.user[0].realname + "批量插入采购记录，批量添加返款记录" + err);
            }
          });
          purchase.executeSql(bankDetailSql,function(err,result){//插入流水账sql
            if(err){
              logger.error(req.session.user[0].realname + "批量插入采购记录，批量添加流水账出错" + err);
            }
          });

          res.json({"code":"000000",message:importMessage});
        });

      });
    });
  });

});
//检验格式是否正确
function verData(req,purchases){
  var correctData=[];
  var errData=[];
  for(var i = 0 ;i < purchases.length;i++){
    //非空验证
    var d = {};
    d.time=purchases[i].time,
    d.product_code=purchases[i].product_code;
    d.product_id = purchases[i].product_id;
    d.purchase_mack_price=purchases[i].purchase_mack_price;
    d.purchase_number=purchases[i].purchase_number;
    d.purchase_other_money=purchases[i].purchase_other_money;
    d.make_money_time=purchases[i].make_money_time;
    d.send_out_time=purchases[i].send_out_time;
    d.storage_time=purchases[i].storage_time;
    d.batch_number=purchases[i].batch_number;
    d.ticket_number=purchases[i].ticket_number;
    if(util.isEmpty(d.time) || util.isEmpty(d.product_code) ||util.isEmpty(d.purchase_mack_price) ||util.isEmpty(d.purchase_number)
        ||util.isEmpty(d.batch_number)||util.isEmpty(d.make_money_time)||util.isEmpty(d.send_out_time)||util.isEmpty(d.storage_time)){
      d.errorMessage = "备货日期、产品编号、备货单价、备货数量、打款时间、发货时间、入库时间、批号为必填项";
      errData.push(d);
      continue;
    }
    //验证编码是否存在
    if(util.isEmpty(d.product_id)){
      d.errorMessage = "产品编码不存在";
      errData.push(d);
      continue;
    }
    if(d.storage_time && !d.batch_number){
      d.errorMessage = "入库时间填写时，批号必填";
      errData.push(d);
      continue;
    }
    //验证价格
    var moneyReg = /^(([1-9]\d+(.[0-9]{1,})?|\d(.[0-9]{1,})?)|([-]([1-9]\d+(.[0-9]{1,})?|\d(.[0-9]{1,})?)))$/;
    if(!moneyReg.test(d.purchase_mack_price)){
      d.errorMessage = "备货单价或填写错误";
      errData.push(d);
      continue;
    }
    d.storage_time = new Date(purchases[i].storage_time).format("yyyy-MM-dd");
    d.send_out_time = new Date(purchases[i].send_out_time).format("yyyy-MM-dd");
    d.make_money_time = new Date(purchases[i].make_money_time).format("yyyy-MM-dd");
    var rst = util.getReturnTime(new Date(purchases[i].make_money_time),purchases[i].product_return_time_type,purchases[i].product_return_time_day,purchases[i].product_return_time_day_num);
    d.refunds_should_time = rst.format("yyyy-MM-dd");
    d.time = new Date(d.time).format("yyyy-MM-dd");
    d.group_id = req.session.user[0].group_id;
    d.purchase_create_userid = req.session.user[0].id;
    var createTime = new Date();
    createTime.setTime(createTime.getTime()+i*1000);
    d.purchase_create_time = createTime.format('yyyy-MM-dd hh:mm:ss');
    d.puchase_gross_rate = (100 - purchases[i].product_discount).toFixed(0);
    d.purchase_return_flag = purchases[i].product_return_statistics;
    d.purchase_price = purchases[i].product_price;
    d.product_return_money = purchases[i].product_return_money;
    if(!util.isEmpty(purchases[i].product_return_money)){
      d.refunds_should_money = util.mul(purchases[i].product_return_money,purchases[i].purchase_number,2);
    }else{
      d.refunds_should_money = "";
    }
    d.purchase_money = util.mul(purchases[i].purchase_mack_price,purchases[i].purchase_number,2);
    correctData.push(d);
  }
  return {
    correctData:correctData,
    errData:errData
  };
}
function getPurchasesData(req,purchases){
  //去空格处理
  var pdCode = "";
  for(var i = 1 ; i < purchases.length;i++){
    pdCode+="\'"+purchases[i][1]+"\',"
    for(var j = 0 ;j<purchases[i].length ;j++){
      purchases[i][j] = purchases[i][j].trim();
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
        logger.error(req.session.user[0].realname + "导入采购记录，查询药品出错" + err);
         reject(err);
      }else{
        //将上传的数据，封闭成对象
        var purchasesDrugsData=[];
        for(var i = 1 ;i < purchases.length;i++){
          var d = arrayToObject(purchases[i]);
          var f = true;
          for(var j = 0 ; j<result.length;j++){
            if(d.product_code == result[j].product_code){
              result[j].time=d.time;
              result[j].purchase_mack_price=d.purchase_mack_price;
              result[j].purchase_number=d.purchase_number;
              result[j].purchase_other_money=d.purchase_other_money;
              result[j].make_money_time=d.make_money_time;
              result[j].send_out_time = d.send_out_time;
              result[j].storage_time = d.storage_time;
              result[j].batch_number = d.batch_number;
              result[j].ticket_number = d.ticket_number;
              var temp = JSON.stringify(result[j]);
              purchasesDrugsData.push(JSON.parse(temp));
              f = false;
            }
          }
          if(f){
            purchasesDrugsData.push(d);
          }
        }
        resolve(purchasesDrugsData);
      }
    });
  });
}
//将数组转成对象
function arrayToObject(sales){
  return {
    time:sales[0],
    product_code:sales[1],
    purchase_mack_price:sales[2],
    purchase_number:sales[3],
    purchase_other_money:sales[4]?sales[4]:"",
    make_money_time:sales[5]?sales[5]:"",
    send_out_time:sales[6]?sales[6]:"",
    storage_time:sales[7]?sales[7]:"",
    batch_number:sales[8]?sales[8]:"",
    ticket_number:sales[9]?sales[9]:""
  }
}
//新增采购记录
router.post("/savePurchases",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",53,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  req.body.time = new Date(req.body.time).format("yyyy-MM-dd");
  if(req.body.storage_time){
    req.body.storage_time = new Date(req.body.storage_time).format("yyyy-MM-dd");
  }else{
    delete req.body.storage_time;
  }
  if(req.body.send_out_time){
    req.body.send_out_time = new Date(req.body.send_out_time).format("yyyy-MM-dd");
  }else{
    delete req.body.send_out_time;
  }
  if(req.body.make_money_time){
    req.body.make_money_time = new Date(req.body.make_money_time).format("yyyy-MM-dd");
  }else{
    delete req.body.make_money_time;
  }
  var stock = parseInt(req.body.stock);
  var productReturnMoney = req.body.product_return_money;
  delete req.body.stock;
  var purchase = DB.get("Purchase");
  req.body.group_id = req.session.user[0].group_id;
  req.body.purchase_create_userid = req.session.user[0].id;
  req.body.purchase_create_time = new Date();
  var returnTime={
    product_return_time_type:req.body.product_return_time_type,
    product_return_time_day:req.body.product_return_time_day,
    product_return_time_day_num:req.body.product_return_time_day_num
  }
  purchase.insert(req.body,'purchase_id',function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "新增采购记录出错" + err);
    }
    var message = req.session.user[0].realname+"新增采进记录。id："+result;
    util.saveLogs(req.session.user[0].group_id,"-",JSON.stringify(req.body),message);
    //新增高打返款记录
    saveRefundsPurchase(req,productReturnMoney,result,returnTime);
    updateStatchStock(req,result);
    res.json({"code":"000000",message:result});
  });
});
function updateStatchStock(req,result){
  if(req.body.storage_time){//入库更新库存
    var batchStock = DB.get("BatchStock");
    //联合主键，更新库存
    var stockSql = "insert into batch_stock values "+
                   "('"+req.body.drug_id+"','"+result+"','"+req.body.purchase_number+"','"+req.body.storage_time+"','"+req.body.batch_number+"','0','"+req.session.user[0].group_id+"')";
    stockSql += " ON DUPLICATE KEY UPDATE batch_stock_number=VALUES(batch_stock_number),batch_number=VALUES(batch_number),batch_stock_time=VALUES(batch_stock_time);"
    batchStock.executeSql(stockSql,function(err,result){
      if(err){
        logger.error(req.session.user[0].realname + "更新批次库存出错" + err);
      }
    });
  }
}
//新增 返款记录
function saveRefundsPurchase(req,productReturnMoney,id,returnTime){
  //新增返款记录  并保存应返金额
  var m = {
    refund_create_time:new Date(),
    refund_create_userid:req.session.user[0].id,
    refunds_policy_money:productReturnMoney,
    purchases_id:id,
  }
  if(req.body.make_money_time){
    var rst = util.getReturnTime(new Date(req.body.make_money_time),returnTime.product_return_time_type,returnTime.product_return_time_day,returnTime.product_return_time_day_num);
    m.refunds_should_time = rst.format("yyyy-MM-dd");
  }
  if(!util.isEmpty(productReturnMoney)){
    m.refunds_should_money = util.mul(productReturnMoney,req.body.purchase_number,2);
  }


  var refunds = DB.get("Refunds");
  refunds.insert(m,'refunds_id',function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "采购记录，新增返款记录出错" + err);
    }
  });

  //保存返款流水，如果保存时，还没有返款或者没有添加收款信息，则标识为删除
  var bankaccountdetail={};
  bankaccountdetail.account_detail_deleta_flag = '1';
  bankaccountdetail.account_detail_group_id = req.session.user[0].group_id;
  bankaccountdetail.flag_id = "purchase_"+id;
  bankaccountdetail.account_detail_create_time = new Date();
  bankaccountdetail.account_detail_create_userid = req.session.user[0].id;
  var accountDetail = DB.get("AccountDetail");
  accountDetail.insert(bankaccountdetail,'account_detail_id',function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "添加返款新增流水出错" + err);
    }
  });
}
//编辑菜单
router.post("/editPurchase",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",54,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var purchase = DB.get("Purchase");
  req.body.time = new Date(req.body.time).format("yyyy-MM-dd");
  if(req.body.storage_time){
    req.body.storage_time = new Date(req.body.storage_time).format("yyyy-MM-dd");
  }else{
    delete req.body.storage_time;
  }
  if(req.body.send_out_time){
    req.body.send_out_time = new Date(req.body.send_out_time).format("yyyy-MM-dd");
  }else{
    delete req.body.send_out_time;
  }
  if(req.body.make_money_time){
    req.body.make_money_time = new Date(req.body.make_money_time).format("yyyy-MM-dd");
  }else{
    delete req.body.make_money_time;
  }
  var params = {
    purchase_id:req.body.purchase_id,
		purchase_number:req.body.purchase_number,
		purchase_money:req.body.purchase_money,
		time:req.body.time,
		send_out_time:req.body.send_out_time,
		storage_time:req.body.storage_time,
		make_money_time:req.body.make_money_time,
		remark:req.body.remark,
    batch_number:req.body.batch_number,
    ticket_number:req.body.ticket_number,
    purchase_other_money:req.body.purchase_other_money,
  }
  var front_purchase = req.body.front_purchase;
  purchase.update(params,'purchase_id',function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "修改采购记录出错" + err);
    }
    var message = req.session.user[0].realname+"修改采进记录。";
    util.saveLogs(req.session.user[0].group_id,front_purchase,JSON.stringify(params),message);
    //更新高打返款记录金额
    updateRefundsPurchase(req);
    //更新库存
    updateStock(req);
    //如果修改了补点/费用票，更新应付记录
    updatePay(req);
    res.json({"code":"000000",message:null});
  });

});
//更新调货 销售应付
function updatePay(req){
  var purchase_other_money_other = req.body.purchase_other_money/req.body.purchase_number;
  purchase_other_money_other = purchase_other_money_other?purchase_other_money_other:0;
  var getSalesSql = "select s.*,d.product_return_money,p.purchase_number,r.refunds_real_money from sales s left join drugs d on d.product_code = s.product_code "+
                    "left join purchase p on p.purchase_id = s.sales_purchase_id "+
                    "left join refunds r on s.sales_purchase_id = r.purchases_id "+
                    "where s.delete_flag = '0' and s.group_id = '"+req.session.user[0].group_id+"' and s.sales_purchase_id = '"+req.body.purchase_id+"' ";
  var getAllotsSql = "select a.*,d.product_return_money,p.purchase_number,r.refunds_real_money from allot a left join drugs d on d.product_id = a.allot_drug_id "+
                     "left join purchase p on p.purchase_id = a.allot_purchase_id "+
                     "left join refunds r on r.purchases_id = a.allot_purchase_id  "+
                     "where a.allot_delete_flag = '0' and a.allot_group_id = '"+req.session.user[0].group_id+"' and a.allot_purchase_id = '"+req.body.purchase_id+"'";
  var sales = DB.get("Sales");
  sales.executeSql(getSalesSql,function(err,result){//查询现有库存
    if(err){
      logger.error(req.session.user[0].realname + "修改采进记录，修改其它费用时，先查询销售记录" + err);
    }
    var salesHospital = "insert into sales (sale_id,sale_return_money,sale_other_money,sale_return_price) values "
    var updateFlag = false;
    for(var i = 0 ; i < result.length ; i++){
      updateFlag=true;
      var saleOtherMeony = purchase_other_money_other*result[i].sale_num;
      var realReturnMoney = result[i].refunds_real_money/result[i].purchase_number;
      realReturnMoney = realReturnMoney?realReturnMoney:result[i].product_return_money;
      var policyMoney = util.getShouldPayMoney(result[i].sale_should_pay_formula,result[i].sale_price,realReturnMoney,result[i].sale_should_pay_percent,purchase_other_money_other,result[i].sale_return_price);
      var policyPrice = util.getShouldPayMoney(result[i].sale_should_pay_formula,result[i].sale_price,realReturnMoney,result[i].sale_should_pay_percent,0,result[i].sale_return_price);
      policyPrice = Math.round(policyPrice*100)/100;
      var t = policyMoney*result[i].sale_num;
      t = Math.round(t*100)/100;
      saleOtherMeony = Math.round(saleOtherMeony*100)/100;
      salesHospital+="('"+result[i].sale_id+"','"+t+"','"+saleOtherMeony+"','"+policyPrice+"'),";
    }
    if(updateFlag){//判断是否更新
      salesHospital = salesHospital.substring(0,salesHospital.length-1);
      salesHospital +=" on duplicate key update sale_return_money=values(sale_return_money),sale_return_price=values(sale_return_price),sale_other_money=values(sale_other_money)";
      sales.executeSql(salesHospital,function(err,result){//更新记录
        if(err){
          logger.error(req.session.user[0].realname + "更新采进后，将所有的销售记录更新出错" + err);
        }
      });
    }
  });
  sales.executeSql(getAllotsSql,function(err,result){//查询现有库存
    if(err){
      logger.error(req.session.user[0].realname + "修改采进记录，修改其它费用时，先查询调货记录" + err);
    }
    var allotHospital = "insert into allot (allot_id,allot_return_money,allot_other_money,allot_return_price) values "
    var updateFlag = false;
    for(var j = 0 ; j < result.length ;j++){//这个循环，查询要更新-复制政策目标医院，的调货记录，根据记录id更新
      updateFlag=true;
      var allotOtherMeony = purchase_other_money_other*result[j].allot_number;
      var realReturnMoney = result[j].refunds_real_money/result[j].purchase_number;
      realReturnMoney = realReturnMoney?realReturnMoney:result[j].product_return_money;
      var policyMoney = util.getShouldPayMoney(result[j].allot_should_pay_formula,result[j].allot_price,realReturnMoney,result[j].allot_should_pay_percent,purchase_other_money_other,result[j].allot_return_price);
      var policyPrice = util.getShouldPayMoney(result[j].allot_should_pay_formula,result[j].allot_price,realReturnMoney,result[j].allot_should_pay_percent,0,result[j].allot_return_price);
      policyPrice = Math.round(policyPrice*100)/100;
      allotOtherMeony = Math.round(allotOtherMeony*100)/100;
      var t = policyMoney*result[j].allot_number;
      t = Math.round(t*100)/100;
      allotHospital+="('"+result[j].allot_id+"','"+t+"','"+allotOtherMeony+"','"+policyPrice+"'),";
    }
    if(updateFlag){//判断是否更新
      allotHospital = allotHospital.substring(0,allotHospital.length-1);
      allotHospital +=" on duplicate key update allot_other_money=values(allot_other_money),allot_return_price=values(allot_return_price),allot_return_money=values(allot_return_money)";
      sales.executeSql(allotHospital,function(err,result){//更新记录
        if(err){
          logger.error(req.session.user[0].realname + "更新政策后，将所有的调货记录更新出错" + err);
        }
      });
    }

  });

}
//更新库存
function updateStock(req){
  if(req.body.storage_time || req.body.storage_time_temp){//入库更新库存
    var stock = 0;
    if(req.body.storage_time_temp && req.body.storage_time){
      stock = -parseInt(req.body.purchase_number_temp)+parseInt(req.body.purchase_number);
    }else if(req.body.storage_time_temp && !req.body.storage_time){
      stock = -parseInt(req.body.purchase_number);
    }else if(!req.body.storage_time_temp && req.body.storage_time){
      stock = parseInt(req.body.purchase_number);
    }
    //更新库存
    var batchStock = DB.get("BatchStock");
    var  getStock = "select bs.batch_stock_number from batch_stock bs where "+
                    "bs.batch_stock_purchase_id = '"+req.body.purchase_id+"' and bs.batch_stock_drug_id = '"+req.body.product_id+"' "+
                    "and bs.tag_type_group_id = '"+req.session.user[0].group_id+"' and bs.tag_type_delete_flag = '0' ";
    batchStock.executeSql(getStock,function(err,result){//查询现有库存
      if(err){
        logger.error(req.session.user[0].realname + "更新批次库存，查询现库存出错" + err);
      }
      var nowStock = result.length>0?result[0].batch_stock_number:0;
      stock = parseInt(stock)+ parseInt(nowStock);
      //联合主键，更新库存
      var stockSql = "insert into batch_stock values "+
                     "('"+req.body.product_id+"','"+req.body.purchase_id+"','"+stock+"','"+req.body.storage_time+"','"+req.body.batch_number+"','0','"+req.session.user[0].group_id+"')";
      stockSql += " ON DUPLICATE KEY UPDATE batch_stock_number=VALUES(batch_stock_number),batch_number=VALUES(batch_number),batch_stock_time=VALUES(batch_stock_time);"
      batchStock.executeSql(stockSql,function(err,result){
        if(err){
          logger.error(req.session.user[0].realname + "更新批次库存出错" + err);
        }
      });
    });
  }
}
//更新返款金额
function updateRefundsPurchase(req){
  var returnTime={
    product_return_time_type:req.body.product_return_time_type,
    product_return_time_day:req.body.product_return_time_day,
    product_return_time_day_num:req.body.product_return_time_day_num
  }
  //新增返款记录  并保存应返金额
  var m = {
    purchases_id:req.body.purchase_id,
  }
  if(req.body.make_money_time){
    var rst = util.getReturnTime(new Date(req.body.make_money_time),returnTime.product_return_time_type,returnTime.product_return_time_day,returnTime.product_return_time_day_num);
    m.refunds_should_time = rst.format("yyyy-MM-dd");
  }
  if(!util.isEmpty(req.body.product_return_money)){
    m.refunds_should_money = util.mul(req.body.product_return_money,req.body.purchase_number,2);
  }
  var refunds = DB.get("Refunds");
  refunds.update(m,'purchases_id',function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "修改高打记录，修改返款记录出错" + err);
    }
  });
}
//删除菜单
router.post("/deletePurchases",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",55,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var stock = parseInt(req.body.stock);
  var productId = req.body.product_id;
  var purchaseNumber = parseInt(req.body.purchase_number);
  var storageTime = req.body.storage_time;
  delete req.body.stock;
  delete req.body.product_id;
  delete req.body.purchase_number;
  delete req.body.storage_time;
  var purchase = DB.get("Purchase");
  req.body.delete_flag = 1;
  purchase.update(req.body,'purchase_id',function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "删除采购记录出错" + err);
    }
    var message = req.session.user[0].realname+"删除采进记录。id："+req.body.purchase_id;
    util.saveLogs(req.session.user[0].group_id,"-","-",message);
    res.json({"code":"000000",message:null});
  });

  if(storageTime){//入库更新库存
    var batchStock = DB.get("BatchStock");
    var sql = "update batch_stock set tag_type_delete_flag = '1' where batch_stock_drug_id = '"+productId+"' and batch_stock_purchase_id = '"+req.body.purchase_id+"' ";
    batchStock.executeSql(sql,function(err,result){
      if(err){
        logger.error(req.session.user[0].realname + "删除采购记录，更新批次库存出错" + err);
      }
    });
  }
});
//导出备货列表
router.post("/exportPurchases",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",57,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var purchase = DB.get("Purchase");
  var findParam = JSON.stringify(req.body);
  req.body.data = JSON.parse(findParam);
  var sql = getPurchasesSql(req);
  sql += " order by p.time desc,p.purchase_create_time asc";
  purchase.executeSql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "导出采购记录出错" + err);
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
    },{caption:'供货单位',type:'string'
    },{caption:'药品',type:'string'
    },{caption:'规格',type:'string'
    },{caption:'生产厂家',type:'string'
    },{caption:'单位',type:'string'
    },{caption:'大包装',type:'number'
    },{caption:'数量',type:'number'
    },{caption:'打款单价',type:'number'
    },{caption:'金额',type:'number'
    },{caption:'中标价',type:'number'
    },{caption:'毛利率（百分比）',type:'string',
      beforeCellWrite:function(row, cellData){
        return cellData+"%";
      }
    }];
    var header = ['time', 'product_supplier', 'product_common_name', 'product_specifications', 'product_makesmakers','product_unit','product_packing','purchase_number','purchase_mack_price','purchase_money','purchase_price','puchase_gross_rate'];
    conf.rows = util.formatExcel(header,result);
    var result = nodeExcel.execute(conf);
    var message = req.session.user[0].realname+"导出采进记录。"+conf.rows.length+"条";
    util.saveLogs(req.session.user[0].group_id,"-",findParam,message);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats');
    res.setHeader("Content-Disposition", "attachment; filename=" + "Report.xlsx");
    res.end(result, 'binary');
  });
});
//获取备货列表
router.post("/getPurchases",function(req,res){
  var noDate = new Date();
  if(req.session.user[0].authority_code.indexOf(",56,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var purchase = DB.get("Purchase");
  var sql = getPurchasesSql(req);
  purchase.countBySql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "查询采购记录，查询总数出错" + err);
    }
    var numSql = "select sum(num.purchase_money) as purchaseMoney from ( " + sql + " ) num";
    purchase.executeSql(numSql,function(err,purchaseMoney){
      if(err){
        logger.error(req.session.user[0].realname + "查询采购记录，统计金额出错" + err);
      }
      req.body.page.purchaseMoney = purchaseMoney && purchaseMoney[0].purchaseMoney?Math.round(purchaseMoney[0].purchaseMoney*100)/100:0;
      req.body.page.totalCount = result;
      req.body.page.totalPage = Math.ceil(req.body.page.totalCount / req.body.page.limit);
      sql += " order by p.time desc,p.purchase_create_time desc limit " + req.body.page.start + "," + req.body.page.limit + "";
      purchase.executeSql(sql,function(err,result){
        if(err){
          logger.error(req.session.user[0].realname + "查询采购记录出错" + err);
        }
        req.body.page.data = result;
        logger.error(req.session.user[0].realname + "purchase-getPurchases运行时长" + (noDate.getTime()-new Date().getTime()));
        res.json({"code":"000000",message:req.body.page});
      });
    });
  });
});
function getPurchasesSql(req){
  var sql = "select p.purchase_id,p.time,p.purchase_number,p.purchase_money,p.purchase_mack_price,p.purchase_price,p.batch_number,p.purchase_other_money,"+
            "p.puchase_gross_rate,p.make_money_time,p.send_out_time,p.storage_time,p.remark,bus.business_name,c.contacts_name,"+
            "d.product_id,d.stock,d.product_code,d.product_type,d.buyer,d.product_common_name,p.ticket_number,"+
            "d.product_specifications,d.product_supplier,d.product_makesmakers,d.product_unit,d.product_packing,d.product_return_money,"+
            "d.product_return_time_type,d.product_return_time_day,d.product_return_time_day_num "+
            "from purchase p "+
            "left join drugs d on p.drug_id = d.product_id "+
            "left join business bus on d.product_business = bus.business_id "+
            "left join contacts c on d.contacts_id = c.contacts_id "+
            "where p.delete_flag = '0' and p.group_id = '"+req.session.user[0].group_id+"' "+
            "and d.delete_flag = '0' and d.group_id = '"+req.session.user[0].group_id+"' ";
  //数据权限
  if(req.session.user[0].data_authority == "2"){
    sql += "and p.purchase_create_userid = '"+req.session.user[0].id+"'";
  }
  if(!util.isEmpty(req.body.data.otherMoneyFlag) && req.body.data.otherMoneyFlag == "2"){
    sql += "and (p.purchase_other_money is null || p.purchase_other_money = '' || p.purchase_other_money = '0') ";
  }else if(!util.isEmpty(req.body.data.otherMoneyFlag) && req.body.data.otherMoneyFlag == "3"){
    sql += "and p.purchase_other_money is not null && p.purchase_other_money != '' && p.purchase_other_money != '0' ";
  }
  if(!util.isEmpty(req.body.data.batch_number)){
    sql += "and p.batch_number = '"+req.body.data.batch_number+"'";
  }
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
  if(!util.isEmpty(req.body.data.status)){
    switch (req.body.data.status) {
      case '1':
        sql += " and p.make_money_time is null";
        break;
      case '2':
        sql += " and p.make_money_time is not null and p.send_out_time is null";
        break;
      case '3':
        sql += " and p.send_out_time is not null and p.storage_time is null";
        break;
      case '4':
        sql += " and p.storage_time is not null";
        break;
      default:
    }
  }
  if(!util.isEmpty(req.body.data.remark)){
    sql += " and p.remark = '"+req.body.data.remark+"'"
  }
  if(!util.isEmpty(req.body.data.time)){
    var start = new Date(req.body.data.time[0]).format("yyyy-MM-dd");
    var end = new Date(req.body.data.time[1]).format("yyyy-MM-dd");
    sql += " and DATE_FORMAT(p.time,'%Y-%m-%d') >= '"+start+"' and DATE_FORMAT(p.time,'%Y-%m-%d') <= '"+end+"'";
  }
  return sql;
}
//分组查询，获取备注
router.post("/getPurchaseRemarks",function(req,res){
  var purchase = DB.get("Purchase");
  var sql = "select p.remark from purchase p where p.delete_flag = '0' and p.group_id = '"+req.session.user[0].group_id+"' and p.remark is not null and p.remark !='' group by p.remark"
  purchase.executeSql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "查询采购记录，分组查询备注出错" + err);
    }
    res.json({"code":"000000",message:result});
  });
});
module.exports = router;
