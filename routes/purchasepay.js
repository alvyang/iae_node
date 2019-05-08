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
router.get("/downloadErrorPurchasePays",function(req,res){
  var conf ={};
  conf.stylesXmlFile = "./utils/styles.xml";
  conf.name = "mysheet";
  conf.cols = [{caption:'合同日期',type:'string'
  },{caption:'产品编号',type:'string'
  },{caption:'打款价',type:'number'
  },{caption:'预付数量',type:'number'
  },{caption:'打款时间',type:'string'
  },{caption:'业务员',type:'string'
  },{caption:'补点/费用票',type:'string'
  },{caption:'错误信息',type:'string'
  }];
  var header = ['purchase_pay_contract_time','product_code','purchase_pay_price','purchase_pay_number','purchase_pay_time',
                'purchase_pay_contact_name','purchase_pay_other_money','errorMessage'];
  var d = JSON.parse(req.session.errorSalesData);

  conf.rows = util.formatExcel(header,d);
  var result = nodeExcel.execute(conf);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats');
  res.setHeader("Content-Disposition", "attachment; filename=" + "error.xlsx");
  res.end(result, 'binary');
});
//导入采购记录
router.post("/importPurchasePay",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",155,") < 0){
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
      getPurchasePayData(req,output).then(data=>{
        var purchasesData= verData(req,data);
        req.session.errorSalesData = null;
        req.session.errorSalesData = JSON.stringify(purchasesData.errData);//错误的数据
        var sData = purchasesData.correctData;//正确的数据
        var importMessage = "数据导入成功<a style='color:red;'>"+sData.length+"</a>条；导入错误<a style='color:red;'>"+purchasesData.errData.length+"</a>条；"
        if(sData.length<1){
          res.json({"code":"000000",message:importMessage});
          var message = req.session.user[0].realname+"导入预付招商记录，数据导入错误"+purchasesData.errData.length+"条；";
          util.saveLogs(req.session.user[0].group_id,"-","-",message);
          return;
        }
        //新增采购记录
        var sql = "insert into purchase_pay(purchase_pay_id,purchase_pay_group_id,purchase_pay_create_time,purchase_pay_drug_id,purchase_pay_create_userid,purchase_pay_contract_time,"+
                  "purchase_pay_time,purchase_pay_price,purchase_pay_number,purchase_pay_money,purchase_pay_should_time,purchase_pay_should_price,purchase_pay_should_money,"+
                  "purchase_pay_other_money,purchase_pay_contact_id,purchase_pay_policy_price,purchase_pay_should_pay_money,purchase_pay_receive_remark) VALUES ";

        //新增返款流水和医院销售回款流水
        var bankDetailSql = "insert into bank_account_detail(account_detail_id,account_detail_deleta_flag,account_detail_group_id,"+
                            "flag_id,account_detail_create_time,account_detail_create_userid) VALUES ";
        var createUserId = req.session.user[0].id;
        for(var i = 0 ; i < sData.length ;i++){
          var createTime = new Date().format('yyyy-MM-dd  hh:mm:ss');
          sData[i].purchase_pay_id = uuid.v1();
          sql += "('"+sData[i].purchase_pay_id+"','"+sData[i].purchase_pay_group_id+"','"+sData[i].purchase_pay_create_time+"',"+
                 "'"+sData[i].purchase_pay_drug_id+"','"+sData[i].purchase_pay_create_userid+"','"+sData[i].purchase_pay_contract_time+"',"+
                 "'"+sData[i].purchase_pay_time+"','"+sData[i].purchase_pay_price+"','"+sData[i].purchase_pay_number+"','"+sData[i].purchase_pay_money+"',"+
                 "'"+sData[i].purchase_pay_should_time+"','"+sData[i].purchase_pay_should_price+"','"+sData[i].purchase_pay_should_money+"',"+
                 "'"+sData[i].purchase_pay_other_money+"','"+sData[i].purchase_pay_contact_id+"','"+sData[i].purchase_pay_policy_price+"',"+
                 "'"+sData[i].purchase_pay_should_pay_money+"',''),"

          bankDetailSql += "('"+uuid.v1()+"','1','"+sData[i].purchase_pay_group_id+"','purchase_pay_"+sData[i].purchase_pay_id+"','"+createTime+"','"+createUserId+"'),"+
                           "('"+uuid.v1()+"','1','"+sData[i].purchase_pay_group_id+"','purchase_pay_pay_"+sData[i].purchase_pay_id+"','"+createTime+"','"+createUserId+"'),";

        }
        sql = sql.substring(0,sql.length-1);//插入销售sql
        bankDetailSql = bankDetailSql.substring(0,bankDetailSql.length-1);//插入销售sql
        var purchasePay = DB.get("PurchasePay");
        purchasePay.executeSql(sql,function(err,result){//批量添加销售记录
          if(err){
            logger.error(req.session.user[0].realname + "批量插入预付招商出错" + err);
          }
          var message = req.session.user[0].realname+"导入预付招商记录，数据导入成功"+sData.length+"条；导入错误"+purchasesData.errData.length+"条；";
          util.saveLogs(req.session.user[0].group_id,"-","-",message);
          purchasePay.executeSql(bankDetailSql,function(err,result){//插入流水账sql
            if(err){
              logger.error(req.session.user[0].realname + "批量插入预付招商记录，批量添加流水账出错" + err);
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
    d.purchase_pay_contract_time=purchases[i].purchase_pay_contract_time,
    d.product_code=purchases[i].product_code;
    d.purchase_pay_price = purchases[i].purchase_pay_price;
    d.purchase_pay_number=purchases[i].purchase_pay_number;
    d.purchase_pay_time=purchases[i].purchase_pay_time;
    d.purchase_pay_contact_name=purchases[i].purchase_pay_contact_name;
    d.purchase_pay_other_money=purchases[i].purchase_pay_other_money;
    d.purchase_pay_drug_id = purchases[i].product_id;
    d.purchase_pay_contact_id = purchases[i].purchase_pay_contact_id;
    d.purchase_pay_contract_time = new Date(purchases[i].purchase_pay_contract_time).format("yyyy-MM-dd");
    d.purchase_pay_time = new Date(purchases[i].purchase_pay_time).format("yyyy-MM-dd");
    if(!d.purchase_pay_contract_time || !d.product_code ||!d.purchase_pay_price ||!d.purchase_pay_number
        ||!d.purchase_pay_time||!d.purchase_pay_contact_name){
      d.errorMessage = "合同日期、产品编号、打款价、预付数量、打款时间、业务员为必填项";
      errData.push(d);
      continue;
    }
    //验证编码是否存在
    if(!d.purchase_pay_drug_id){
      d.errorMessage = "产品编码不存在";
      errData.push(d);
      continue;
    }
    if(!d.purchase_pay_contact_id){
      d.errorMessage = "业务员不存在";
      errData.push(d);
      continue;
    }
    var rst = util.getReturnTime(new Date(purchases[i].purchase_pay_time),purchases[i].product_return_time_type,purchases[i].product_return_time_day,purchases[i].product_return_time_day_num);
    d.purchase_pay_should_time = rst.format("yyyy-MM-dd");
    d.purchase_pay_group_id = req.session.user[0].group_id;
    d.purchase_pay_create_userid = req.session.user[0].id;
    d.purchase_pay_create_time = new Date().format("yyyy-MM-dd  hh:mm:ss");
    if(purchases[i].product_return_money){
      d.purchase_pay_should_money = util.mul(purchases[i].product_return_money,purchases[i].purchase_pay_number,2);
    }else{
      d.purchase_pay_should_money = "";
    }
    d.purchase_pay_should_price = purchases[i].product_return_money;
    d.purchase_pay_money = util.mul(purchases[i].purchase_pay_price,purchases[i].purchase_pay_number,2);

    //应付金额
    purchases[i].purchase_pay_other_money = purchases[i].purchase_pay_other_money?purchases[i].purchase_pay_other_money:0;
    d.purchase_pay_policy_price = purchases[i].purchase_pay_policy_price?purchases[i].purchase_pay_policy_price:"";
    if(purchases[i].purchase_pay_policy_floor_price && purchases[i].purchase_pay_policy_tax){
      var t1 = purchases[i].purchase_pay_price - purchases[i].purchase_pay_policy_floor_price;
      var t2 = t1*(1-purchases[i].purchase_pay_policy_tax/100);
      var t3 = t2 - purchases[i].purchase_pay_other_money;
      d.purchase_pay_should_pay_money = Math.round(t3*100)/100;
    }else if(purchases[i].purchase_pay_policy_price){
      var t = purchases[i].purchase_pay_policy_price*purchases[i].purchase_pay_number - purchases[i].purchase_pay_other_money;
      d.purchase_pay_should_pay_money = Math.round(t*100)/100;
    }else{
      d.purchase_pay_should_pay_money = "";
    }

    correctData.push(d);
  }
  return {
    correctData:correctData,
    errData:errData
  };
}
function getPurchasePayData(req,purchases){
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
        logger.error(req.session.user[0].realname + "导入预付采购记录，查询药品出错" + err);
         reject(err);
      }else{
        //将上传的数据，封闭成对象
        var purchasePayDrugsData=[];
        for(var i = 1 ;i < purchases.length;i++){
          var d = arrayToObject(purchases[i]);
          var f = true;
          for(var j = 0 ; j<result.length;j++){
            if(d.product_code == result[j].product_code){
              result[j].purchase_pay_contract_time=d.purchase_pay_contract_time;
              result[j].purchase_pay_price=d.purchase_pay_price;
              result[j].purchase_pay_number=d.purchase_pay_number;
              result[j].purchase_pay_time=d.purchase_pay_time;
              result[j].purchase_pay_contact_name = d.purchase_pay_contact_name;
              result[j].purchase_pay_other_money = d.purchase_pay_other_money;
              var temp = JSON.stringify(result[j]);
              f = false;
              purchasePayDrugsData.push(JSON.parse(temp));
            }
          }
          if(f){
            purchasePayDrugsData.push(d);
          }
        }
        resolve(purchasePayDrugsData);
      }
    });
  }).then(purchasePayDrugsData => {
    return new Promise((resolve, reject) => {
      var contacts = DB.get("Contacts");
      var sql = "select * from contacts c where c.group_id = '"+req.session.user[0].group_id+"' and c.delete_flag = '0' "+
                "and c.contact_type like '%业务员%'";
      contacts.executeSql(sql,function(err,result){
        if(err){
          logger.error(req.session.user[0].realname + "导入预付政策数据，查询销售业务员出错" + err);
          reject(err);
        }else{
          var contactId = "";
          for(var i = 0 ; i < purchasePayDrugsData.length;i++){
            for(var j = 0 ;j < result.length;j++){
              if(purchasePayDrugsData[i].purchase_pay_contact_name == result[j].contacts_name){
                contactId+="\'"+result[j].contacts_id+"\',";
                purchasePayDrugsData[i].purchase_pay_contact_id = result[j].contacts_id;
              }
            }
          }
          contactId = contactId.substring(0,contactId.length-1);
          resolve({purchasePayDrugsData:purchasePayDrugsData,contactId:contactId});
        }
      });
    });
  }).then(data => {
    return new Promise((resolve, reject) => {
      var p = data.purchasePayDrugsData;
      if(data.contactId){
        var purchasePayPolicy = DB.get("PurchasePayPolicy");
        var sql = "select * from purchase_pay_policy p where p.purchase_pay_contact_id in ("+data.contactId+") "+
                  "and p.purchase_pay_policy_price is not null and p.purchase_pay_policy_price != '' ";
        purchasePayPolicy.executeSql(sql,function(err,result){
          if(err){
            logger.error(req.session.user[0].realname + "导入预付政策数据，查询销售预付政策出错" + err);
            reject(err);
          }else{
            for(var i = 0 ; i < p.length;i++){
              for(var j = 0 ;j < result.length;j++){
                if(p[i].purchase_pay_contact_id == result[j].purchase_pay_contact_id &&
                   p[i].product_id == result[j].purchase_pay_policy_drug_id ){

                  p[i].purchase_pay_policy_floor_price = result[j].purchase_pay_policy_floor_price;
                  p[i].purchase_pay_policy_tax = result[j].purchase_pay_policy_tax;
                  p[i].purchase_pay_policy_price = result[j].purchase_pay_policy_price;
                  p[i].purchase_pay_policy_remark = result[j].purchase_pay_policy_remark;
                }
              }
            }
            resolve(p);
          }
        });
      }else{
        resolve(p);
      }
    });
  });
}
//将数组转成对象
function arrayToObject(sales){
  return {
    purchase_pay_contract_time:sales[0],
    product_code:sales[1],
    purchase_pay_price:sales[2],
    purchase_pay_number:sales[3],
    purchase_pay_time:sales[4]?sales[4]:"",
    purchase_pay_contact_name:sales[5]?sales[5]:"",
    purchase_pay_other_money:sales[6]?sales[6]:"",
  }
}
//新增采购记录
router.post("/savePurchasesPay",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",155,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  req.body.purchase_pay_contract_time = new Date(req.body.purchase_pay_contract_time).format("yyyy-MM-dd");
  if(req.body.purchase_pay_time){
    req.body.purchase_pay_time = new Date(req.body.purchase_pay_time).format("yyyy-MM-dd");
  }else{
    delete req.body.purchase_pay_time;
  }

  req.body.purchase_pay_group_id = req.session.user[0].group_id;
  req.body.purchase_pay_create_userid = req.session.user[0].id;
  req.body.purchase_pay_create_time = new Date();

  var returnTime={
    product_return_time_type:req.body.product_return_time_type,
    product_return_time_day:req.body.product_return_time_day,
    product_return_time_day_num:req.body.product_return_time_day_num
  }
  if(req.body.purchase_pay_time){//应收日期
    var rst = util.getReturnTime(new Date(req.body.purchase_pay_time),returnTime.product_return_time_type,returnTime.product_return_time_day,returnTime.product_return_time_day_num);
    req.body.purchase_pay_should_time = rst.format("yyyy-MM-dd");
  }
  if(req.body.product_return_money){//应收金额
    req.body.purchase_pay_should_price = req.body.product_return_money;
    req.body.purchase_pay_should_money = util.mul(req.body.product_return_money,req.body.purchase_pay_number,2);
  }
  //应付金额
  req.body.purchase_pay_other_money = req.body.purchase_pay_other_money?req.body.purchase_pay_other_money:0;
  req.body.purchase_pay_policy_price = req.body.purchase_pay_policy_price?req.body.purchase_pay_policy_price:0;
  if(req.body.purchase_pay_policy_floor_price && req.body.purchase_pay_policy_tax){
    var t1 = req.body.purchase_pay_price - req.body.purchase_pay_policy_floor_price;
    var t2 = t1*(1-req.body.purchase_pay_policy_tax/100);
    var t3 = t2 - req.body.purchase_pay_other_money;
    req.body.purchase_pay_should_pay_money = Math.round(t3*100)/100;
  }else{
    var t = req.body.purchase_pay_policy_price*req.body.purchase_pay_number - req.body.purchase_pay_other_money;
    req.body.purchase_pay_should_pay_money = Math.round(t*100)/100;
  }
  var purchasePay = DB.get("PurchasePay");
  purchasePay.insert(req.body,'purchase_pay_id',function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "新增预付招商记录出错" + err);
    }
    var message = req.session.user[0].realname+"新增预付招商记录。id："+result;
    util.saveLogs(req.session.user[0].group_id,"-",JSON.stringify(req.body),message);
    //新增高打返款记录
    saveRefundsPurchase(req,result);
    res.json({"code":"000000",message:result});
  });


});
//新增 返款记录
function saveRefundsPurchase(req,id){
  //保存返款流水，如果保存时，还没有返款或者没有添加收款信息，则标识为删除
  var bankaccountdetail={};
  bankaccountdetail.account_detail_deleta_flag = '1';
  bankaccountdetail.account_detail_group_id = req.session.user[0].group_id;
  bankaccountdetail.flag_id = "purchase_pay_"+id;
  bankaccountdetail.account_detail_create_time = new Date();
  bankaccountdetail.account_detail_create_userid = req.session.user[0].id;
  var accountDetail = DB.get("AccountDetail");
  accountDetail.insert(bankaccountdetail,'account_detail_id',function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "添加预付应收增流水出错" + err);
    }
    var accountDetail1 = DB.get("AccountDetail");
    bankaccountdetail.account_detail_id = null;
    bankaccountdetail.flag_id = "purchase_pay_pay_"+id;
    accountDetail1.insert(bankaccountdetail,'account_detail_id',function(err,result){
      if(err){
        logger.error(req.session.user[0].realname + "添加预付应付增流水出错" + err);
      }
    });
  });
}

//编辑应付
router.post("/editPurchasePayReturn",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",164,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var params = {
    purchase_pay_id:req.body.purchase_pay_id,
    purchase_pay_policy_price:req.body.purchase_pay_policy_price,
    purchase_pay_should_pay_money:req.body.purchase_pay_should_pay_money,
    purchase_pay_other_money:req.body.purchase_pay_other_money,
		purchase_pay_real_pay_money:req.body.purchase_pay_real_pay_money,
		purchase_pay_real_account:req.body.purchase_pay_real_account,
		purchase_pay_return_remark:req.body.purchase_pay_return_remark,
    purchase_pay_receive_name:req.body.account_name1,
    purchase_pay_receive_account:req.body.account_number1,
    purchase_pay_receive_address:req.body.account_address1
  }
  if(!req.body.purchase_pay_real_pay_time && !req.body.purchase_pay_real_pay_money && !req.body.purchase_pay_real_account){
    delete params.purchase_pay_receive_name;
    delete params.purchase_pay_receive_account;
    delete params.purchase_pay_receive_address;
  }
  if(req.body.purchase_pay_real_pay_time){
    params.purchase_pay_real_pay_time = new Date(req.body.purchase_pay_real_pay_time).format("yyyy-MM-dd");
  }else{
    delete params.purchase_pay_real_pay_time ;
  }
  var front_purchase = req.body.front_purchase;
  var purchasePay = DB.get("PurchasePay");
  purchasePay.update(params,'purchase_pay_id',function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "修改预付招商应付记录出错" + err);
    }
    var message = req.session.user[0].realname+"修改预付招商应付记录。";
    util.saveLogs(req.session.user[0].group_id,front_purchase,JSON.stringify(params),message);
    res.json({"code":"000000",message:null});
  });

  //修改流水
  var bankaccountdetail={};
  if(!req.body.purchase_pay_real_account && !req.body.purchase_pay_real_pay_time){
    bankaccountdetail.account_detail_deleta_flag = '1';
  }else{
    bankaccountdetail.account_detail_deleta_flag = '0';
    bankaccountdetail.account_id = req.body.purchase_pay_real_account;
  }
  bankaccountdetail.account_detail_money = -req.body.purchase_pay_real_pay_money;
  if(req.body.purchase_pay_real_pay_time){
    bankaccountdetail.account_detail_time = new Date(req.body.purchase_pay_real_pay_time).format("yyyy-MM-dd");
  }
  if(req.body.purchase_pay_time){
    bankaccountdetail.purchase_pay_time = new Date(req.body.purchase_pay_time).format("yyyy-MM-dd");
  }else{
    bankaccountdetail.purchase_pay_time = null;
  }
  var accountDetail = bankaccountdetail.purchase_pay_time+"打款预付招商"+req.body.product_common_name+"付积分";
  bankaccountdetail.account_detail_mark = accountDetail;
  bankaccountdetail.account_detail_group_id = req.session.user[0].group_id;
  bankaccountdetail.flag_id = "purchase_pay_pay_"+req.body.purchase_pay_id;
  bankaccountdetail.account_detail_create_time = new Date();
  bankaccountdetail.account_detail_create_userid = req.session.user[0].id;
  var accountDetail = DB.get("AccountDetail");
  accountDetail.update(bankaccountdetail,'flag_id',function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "修改预付招商付积分修改流水出错" + err);
    }
  });
});
//编辑应收
router.post("/editPurchasePayRefund",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",169,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var params = {
    purchase_pay_should_price:req.body.purchase_pay_should_price,
    purchase_pay_should_money:req.body.purchase_pay_should_money,
    purchase_pay_real_money:req.body.purchase_pay_real_money,
		purchase_pay_service_charge:req.body.purchase_pay_service_charge,
		purchase_pay_refundser:req.body.purchase_pay_refundser,
		purchase_pay_receiver:req.body.purchase_pay_receiver,
		purchase_pay_remark:req.body.purchase_pay_remark,
    purchase_pay_id:req.body.purchase_pay_id
  }
  if(req.body.purchase_pay_should_time){
    params.purchase_pay_should_time = new Date(req.body.purchase_pay_should_time).format("yyyy-MM-dd");
  }else{
    params.purchase_pay_should_time = null;
  }
  if(req.body.purchase_pay_real_time){
    params.purchase_pay_real_time = new Date(req.body.purchase_pay_real_time).format("yyyy-MM-dd");
  }else{
    params.purchase_pay_real_time = null;
  }

  var front_purchase = req.body.front_purchase;
  var purchasePay = DB.get("PurchasePay");
  purchasePay.update(params,'purchase_pay_id',function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "修改预付招商应收记录出错" + err);
    }
    var message = req.session.user[0].realname+"修改预付招商应收记录。";
    util.saveLogs(req.session.user[0].group_id,front_purchase,JSON.stringify(params),message);
    res.json({"code":"000000",message:null});
  });

  //修改流水
  var bankaccountdetail={};
  if(!req.body.purchase_pay_receiver && !req.body.purchase_pay_real_time){
    bankaccountdetail.account_detail_deleta_flag = '1';
  }else{
    bankaccountdetail.account_detail_deleta_flag = '0';
    bankaccountdetail.account_id = req.body.purchase_pay_receiver;
  }
  bankaccountdetail.account_detail_money = req.body.purchase_pay_real_money;
  if(req.body.purchase_pay_real_time){
    bankaccountdetail.account_detail_time = new Date(req.body.purchase_pay_real_time).format("yyyy-MM-dd");
  }
  if(req.body.purchase_pay_time){
    bankaccountdetail.purchase_pay_time = new Date(req.body.purchase_pay_time).format("yyyy-MM-dd");
  }else{
    bankaccountdetail.purchase_pay_time = null;
  }
  var accountDetail = bankaccountdetail.purchase_pay_time+"打款预付招商"+req.body.product_common_name+"收积分";
  bankaccountdetail.account_detail_mark = accountDetail;
  bankaccountdetail.account_detail_group_id = req.session.user[0].group_id;
  bankaccountdetail.flag_id = "purchase_pay_"+req.body.purchase_pay_id;
  bankaccountdetail.account_detail_create_time = new Date();
  bankaccountdetail.account_detail_create_userid = req.session.user[0].id;
  var accountDetail = DB.get("AccountDetail");
  accountDetail.update(bankaccountdetail,'flag_id',function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "修改预付招商收积分流水出错" + err);
    }
  });
});
//编辑菜单
router.post("/editPurchasePay",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",154,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }

  req.body.purchase_pay_contract_time = new Date(req.body.purchase_pay_contract_time).format("yyyy-MM-dd");
  if(req.body.purchase_pay_time){//应收日期
    req.body.purchase_pay_time = new Date(req.body.purchase_pay_time).format("yyyy-MM-dd");
    var rst = util.getReturnTime(new Date(req.body.purchase_pay_time),req.body.product_return_time_type,req.body.product_return_time_day,req.body.product_return_time_day_num);
    req.body.purchase_pay_should_time = rst.format("yyyy-MM-dd");
  }else{
    delete req.body.purchase_pay_time;
  }
  if(req.body.product_return_money){//应收金额
    req.body.purchase_pay_should_money = util.mul(req.body.product_return_money,req.body.purchase_pay_number,2);
  }

  //应付金额
  req.body.purchase_pay_other_money = req.body.purchase_pay_other_money?req.body.purchase_pay_other_money:0;
  if(req.body.purchase_pay_policy_floor_price && req.body.purchase_pay_policy_tax){
    var t1 = req.body.purchase_pay_price - req.body.purchase_pay_policy_floor_price;
    var t2 = t1*(1-req.body.purchase_pay_policy_tax/100);
    var t3 = t2 - req.body.purchase_pay_other_money;
    req.body.purchase_pay_should_pay_money = Math.round(t3*100)/100;
  }else{
    var t = req.body.purchase_pay_policy_price*req.body.purchase_pay_number - req.body.purchase_pay_other_money;
    req.body.purchase_pay_should_pay_money = t?Math.round(t*100)/100:"";
  }

  var params = {
    purchase_pay_should_money:req.body.purchase_pay_should_money,
    purchase_pay_should_pay_money:req.body.purchase_pay_should_pay_money,
    purchase_pay_id:req.body.purchase_pay_id,
		purchase_pay_contact_id:req.body.purchase_pay_contact_id,
		purchase_pay_number:req.body.purchase_pay_number,
		purchase_pay_money:req.body.purchase_pay_money,
		purchase_pay_other_money:req.body.purchase_pay_other_money,
		purchase_pay_contract_time:req.body.purchase_pay_contract_time,
		purchase_pay_time:req.body.purchase_pay_time,
		purchase_pay_receive_remark:req.body.purchase_pay_receive_remark,
  }
  if(req.body.purchase_pay_should_time){
    params.purchase_pay_should_time = req.body.purchase_pay_should_time;
  }
  var front_purchase = req.body.front_purchase;
  var purchasePay = DB.get("PurchasePay");
  purchasePay.update(params,'purchase_pay_id',function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "修改预付招商记录出错" + err);
    }
    var message = req.session.user[0].realname+"修改预付招商记录。";
    util.saveLogs(req.session.user[0].group_id,front_purchase,JSON.stringify(params),message);
    res.json({"code":"000000",message:null});
  });
});
//删除菜单
router.post("/deletePurchasePay",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",153,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var purchasePay = DB.get("PurchasePay");
  req.body.purchase_pay_delete_flag = 1;
  purchasePay.update(req.body,'purchase_pay_id',function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "删除预付招商记录出错" + err);
    }
    var message = req.session.user[0].realname+"删除预付招商记录。id："+req.body.purchase_pay_id;
    util.saveLogs(req.session.user[0].group_id,"-","-",message);
    res.json({"code":"000000",message:null});
  });
});
//删除应收
router.post("/deletePurchasePayRefund",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",167,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var purchasePay = DB.get("PurchasePay");
  req.body.purchase_pay_delete_flag1 = 1;
  purchasePay.update(req.body,'purchase_pay_id',function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "删除预付招商应收记录出错" + err);
    }
    var message = req.session.user[0].realname+"删除预付招商记录。id："+req.body.purchase_pay_id;
    util.saveLogs(req.session.user[0].group_id,"-","-",message);
    res.json({"code":"000000",message:null});
  });
});
//导出应收
router.post("/exportPurchasePayRefund",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",170,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var purchase = DB.get("Purchase");
  var findParam = JSON.stringify(req.body);
  req.body.data = JSON.parse(findParam);
  var sql = getPurchasePaySql(req);
  sql += " order by p.purchase_pay_contract_time desc,p.purchase_pay_create_time desc";
  purchase.executeSql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "导出采购记录出错" + err);
    }
    var conf ={};
    conf.stylesXmlFile = "./utils/styles.xml";
    conf.name = "mysheet";
    conf.cols = [{caption:'业务员',type:'string'
    },{
        caption:'合同时间',
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
    },{caption:'中标价',type:'string'
    },{caption:'预付数量',type:'number'
    },{caption:'打款价',type:'number'
    },{caption:'预付金额',type:'number'
    },{caption:'打款时间',type:'string',
      beforeCellWrite:function(row, cellData){
        if(cellData){
          return new Date(cellData).format('yyyy-MM-dd');
        }else{
          return "";
        }
      }
    },{caption:'积分',type:'number'
    },{caption:'补点/费用票',type:'number'
    },{caption:'应收时间',type:'string',
      beforeCellWrite:function(row, cellData){
        if(cellData){
          return new Date(cellData).format('yyyy-MM-dd');
        }else{
          return "";
        }
      }
    },{caption:'应收积分',type:'number'
    },{caption:'实收时间',type:'string',
      beforeCellWrite:function(row, cellData){
        if(cellData){
          return new Date(cellData).format('yyyy-MM-dd');
        }else{
          return "";
        }
      }
    },{caption:'实收积分',type:'number'
    },{caption:'返积分人',type:'string'
    },{caption:'收款账号',type:'string'
    },{caption:'备注',type:'string'}];

    var header = ['contacts_name1','purchase_pay_contract_time', 'product_supplier', 'product_common_name', 'product_specifications',
                 'product_makesmakers','product_unit','product_packing','product_price','purchase_pay_number','purchase_pay_price',
                 'purchase_pay_money','purchase_pay_time','purchase_pay_should_price','purchase_pay_other_money','purchase_pay_should_time',
                 'purchase_pay_should_money','purchase_pay_real_time','purchase_pay_real_money','purchase_pay_refundser','account_number','purchase_pay_remark'];
    conf.rows = util.formatExcel(header,result);
    var result = nodeExcel.execute(conf);
    var message = req.session.user[0].realname+"导出预付招商记录。"+conf.rows.length+"条";
    util.saveLogs(req.session.user[0].group_id,"-",findParam,message);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats');
    res.setHeader("Content-Disposition", "attachment; filename=" + "Report.xlsx");
    res.end(result, 'binary');
  });
});
//导出备货列表
router.post("/exportPurchasePay",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",150,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var purchase = DB.get("Purchase");
  var findParam = JSON.stringify(req.body);
  req.body.data = JSON.parse(findParam);
  var sql = getPurchasePaySql(req);
  sql += " order by p.purchase_pay_contract_time desc,p.purchase_pay_create_time desc";
  purchase.executeSql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "导出采购记录出错" + err);
    }
    var conf ={};
    conf.stylesXmlFile = "./utils/styles.xml";
    conf.name = "mysheet";
    conf.cols = [{
        caption:'合同时间',
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
    },{caption:'预付数量',type:'number'
    },{caption:'打款价',type:'number'
    },{caption:'预付金额',type:'number'
    },{caption:'中标价',type:'number'
    },{caption:'业务员',type:'string'
    }];
    var header = ['purchase_pay_contract_time', 'product_supplier', 'product_common_name', 'product_specifications',
                 'product_makesmakers','product_unit','product_packing','purchase_pay_number','purchase_pay_price',
                 'purchase_pay_money','product_price','contacts_name1'];
    conf.rows = util.formatExcel(header,result);
    var result = nodeExcel.execute(conf);
    var message = req.session.user[0].realname+"导出预付招商记录。"+conf.rows.length+"条";
    util.saveLogs(req.session.user[0].group_id,"-",findParam,message);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats');
    res.setHeader("Content-Disposition", "attachment; filename=" + "Report.xlsx");
    res.end(result, 'binary');
  });
});
//获取备货列表
router.post("/getPurchasePay",function(req,res){
  var noDate = new Date();
  if(req.session.user[0].authority_code.indexOf(",151,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var purchasePay = DB.get("PurchasePay");
  var sql = getPurchasePaySql(req);
  purchasePay.countBySql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "查询预付招商记录，查询总数出错" + err);
    }
    var numSql = "select sum(num.purchase_pay_should_money) as ppsm,sum(num.purchase_pay_real_money) as pprm, "+
                 "sum(num.purchase_pay_should_pay_money) as ppspm,sum(num.purchase_pay_real_pay_money) as pprpm,"+
                 "sum(num.purchase_pay_service_charge) as ppsc from ("+sql+") num";

    purchasePay.executeSql(numSql,function(err,money){
      if(err){
        logger.error(req.session.user[0].realname + "查询预付招商记录，统计积分收付总额出错" + err);
      }
      req.body.page.ppsm = money && money[0].ppsm?Math.round(money[0].ppsm*100)/100:0;
      req.body.page.pprm = money && money[0].pprm?Math.round(money[0].pprm*100)/100:0;
      req.body.page.ppspm = money && money[0].ppspm?Math.round(money[0].ppspm*100)/100:0;
      req.body.page.pprpm = money && money[0].pprpm?Math.round(money[0].pprpm*100)/100:0;
      req.body.page.ppsc = money && money[0].ppsc?Math.round(money[0].ppsc*100)/100:0;
      req.body.page.totalCount = result;
      req.body.page.totalPage = Math.ceil(req.body.page.totalCount / req.body.page.limit);
      sql += " order by p.purchase_pay_contract_time desc,p.purchase_pay_create_time desc limit " + req.body.page.start + "," + req.body.page.limit + "";
      purchasePay.executeSql(sql,function(err,result){
        if(err){
          logger.error(req.session.user[0].realname + "查询预付招商记录出错" + err);
        }
        req.body.page.data = result;
        logger.error(req.session.user[0].realname + "purchasepay-getPurchasePay运行时长" + (noDate.getTime()-new Date().getTime()));
        res.json({"code":"000000",message:req.body.page});
      });
    });

  });
});
function getPurchasePaySql(req){
  var sql = "select p.*,bus.business_name,c1.contacts_name as contacts_name1,c.contacts_name,d.product_price,"+
            "d.product_id,d.stock,d.product_code,d.product_mack_price,d.product_type,d.buyer,d.product_common_name,"+
            "d.product_specifications,d.product_supplier,d.product_makesmakers,d.product_unit,d.product_packing,d.product_return_money,"+
            "d.product_return_time_type,d.product_return_time_day,d.product_return_time_day_num,ba.account_number,"+
            "c1.account_name as account_name1,c1.account_number as account_number1,c1.account_address as account_address1,"+
            "ba1.account_number as account_number2 "+
            "from purchase_pay p "+
            "left join drugs d on p.purchase_pay_drug_id = d.product_id "+
            "left join business bus on d.product_business = bus.business_id "+
            "left join contacts c on d.contacts_id = c.contacts_id "+
            "left join contacts c1 on p.purchase_pay_contact_id = c1.contacts_id "+
            "left join bank_account ba on ba.account_id = p.purchase_pay_receiver "+
            "left join bank_account ba1 on ba1.account_id = p.purchase_pay_real_account "+
            "where p.purchase_pay_delete_flag = '0' and p.purchase_pay_group_id = '"+req.session.user[0].group_id+"' "+
            "and d.delete_flag = '0' and d.group_id = '"+req.session.user[0].group_id+"' ";
  if(req.body.data.overdue){
    req.body.data.status="未收";
  }
  if(req.body.data.makeMoneyFlag == "2"){
    sql += "and p.purchase_pay_time is not null ";
  }
  if(req.body.data.refundFlag == "2"){
    sql += "and p.purchase_pay_delete_flag1 = '0' ";
  }
  //数据权限
  if(req.session.user[0].data_authority == "2"){
    sql += "and p.purchase_pay_create_userid = '"+req.session.user[0].id+"'";
  }
  if(req.body.data.productCommonName){
    sql += " and (d.product_common_name like '%"+req.body.data.productCommonName+"%' or d.product_name_pinyin like '%"+req.body.data.productCommonName+"%')";
  }
  if(req.body.data.contactId){
    sql += " and d.contacts_id = '"+req.body.data.contactId+"'"
  }
  if(req.body.data.contactId1){
    sql += " and p.purchase_pay_contact_id = '"+req.body.data.contactId1+"'"
  }
  if(req.body.data.product_makesmakers){
    sql += " and d.product_makesmakers like '%"+req.body.data.product_makesmakers+"%'"
  }
  if(req.body.data.product_code){
    sql += " and d.product_code = '"+req.body.data.product_code+"'"
  }
  if(req.body.data.business){
    sql += " and d.product_business = '"+req.body.data.business+"'"
  }
  if(req.body.data.status){
    var s = req.body.data.status=="已收"?"p.purchase_pay_real_time is not null && p.purchase_pay_real_money is not null":"p.purchase_pay_real_time is null && (p.purchase_pay_real_money is null || p.purchase_pay_real_money = '')";
    sql += " and "+s;
  }
  if(req.body.data.payStatus){
    var s = req.body.data.payStatus=="已付"?"p.purchase_pay_real_account !='' && p.purchase_pay_real_pay_money !=''":"p.purchase_pay_real_account ='' && p.purchase_pay_real_pay_money = '' ";
    sql += " and "+s;
  }
  if(req.body.data.time){
    var start = new Date(req.body.data.time[0]).format("yyyy-MM-dd");
    var end = new Date(req.body.data.time[1]).format("yyyy-MM-dd");
    sql += " and DATE_FORMAT(p.purchase_pay_contract_time,'%Y-%m-%d') >= '"+start+"' and DATE_FORMAT(p.purchase_pay_contract_time,'%Y-%m-%d') <= '"+end+"'";
  }
  if(req.body.data.overdue){//查询逾期未返款
    var nowDate = new Date().format("yyyy-MM-dd");
    sql += " and DATE_FORMAT(p.purchase_pay_should_time,'%Y-%m-%d') <= '"+nowDate+"'";
  }
  if(req.body.data.realReturnTime){
    var start = new Date(req.body.data.realReturnTime[0]).format("yyyy-MM-dd");
    var end = new Date(req.body.data.realReturnTime[1]).format("yyyy-MM-dd");
    sql += " and (DATE_FORMAT(p.purchase_pay_real_time,'%Y-%m-%d') >= '"+start+"' and DATE_FORMAT(p.purchase_pay_real_time,'%Y-%m-%d') <= '"+end+"')";
  }
  if(req.body.data.realPayTime){
    var start = new Date(req.body.data.realPayTime[0]).format("yyyy-MM-dd");
    var end = new Date(req.body.data.realPayTime[1]).format("yyyy-MM-dd");
    sql += " and (DATE_FORMAT(p.purchase_pay_real_pay_time,'%Y-%m-%d') >= '"+start+"' and DATE_FORMAT(p.purchase_pay_real_pay_time,'%Y-%m-%d') <= '"+end+"')";
  }
  if(req.body.data.purchase_pay_refundser){
    //查询出与该返款人相关的所有联系人id
    var contactIdSql = "select p.purchase_pay_drug_id from purchase_pay p where p.purchase_pay_group_id = '"+req.session.user[0].group_id+"' ";
        contactIdSql += "and p.purchase_pay_refundser = '"+req.body.data.purchase_pay_refundser+"'";
    contactIdSql = "select cdc.contacts_id from ("+contactIdSql+") csr left join "+
                   "(select cd.product_id,cc.contacts_id from drugs cd left join contacts cc on cd.contacts_id = cc.contacts_id) cdc "+
                   "on csr.purchase_pay_drug_id = cdc.product_id where d.contacts_id = cdc.contacts_id";
    sql += " and exists("+contactIdSql+")";
  }
  if(req.body.data.returnTime){
    var start = new Date(req.body.data.returnTime[0]).format("yyyy-MM-dd");
    var end = new Date(req.body.data.returnTime[1]).format("yyyy-MM-dd");
    sql += " and (DATE_FORMAT(p.purchase_pay_should_time,'%Y-%m-%d') >= '"+start+"' and DATE_FORMAT(p.purchase_pay_should_time,'%Y-%m-%d') <= '"+end+"')";
  }
  return sql;
}

//获取备货列表
router.post("/getPurchasePolicy",function(req,res){
  var purchasePayPolicy = DB.get("PurchasePayPolicy");
  var sql = "select * from purchase_pay_policy p where p.purchase_pay_contact_id = '"+req.body.contactId+"' and p.purchase_pay_policy_drug_id = '"+req.body.drugId+"'";
  purchasePayPolicy.executeSql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "业务员id，药品id，查询预付总数出错" + err);
    }
    res.json({"code":"000000",message:result});
  });
});
//获取返款人列表
router.post("/getPurchasePayRefunder",function(req,res){
  var purchasePayPolicy = DB.get("PurchasePayPolicy");
  var sql = "select p.purchase_pay_refundser from purchase_pay p where p.purchase_pay_group_id = '"+req.session.user[0].group_id+"' "+
            "and p.purchase_pay_delete_flag = '0' and p.purchase_pay_contact_id = '"+req.body.contactId+"' "+
            "and p.purchase_pay_refundser != '' group by p.purchase_pay_refundser";
  purchasePayPolicy.executeSql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "预付应收，获取分组返款人出错" + err);
    }
    res.json({"code":"000000",message:result});
  });
});

//获取返款人列表
router.post("/getPurchasePayAllRefunder",function(req,res){
  var purchasePayPolicy = DB.get("PurchasePayPolicy");
  var sql = "select p.purchase_pay_refundser from purchase_pay p where p.purchase_pay_group_id = '"+req.session.user[0].group_id+"' "+
            "and p.purchase_pay_delete_flag = '0' "+
            "and p.purchase_pay_refundser != '' group by p.purchase_pay_refundser";
  purchasePayPolicy.executeSql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "预付应收，获取分组返款人出错" + err);
    }
    res.json({"code":"000000",message:result});
  });
});

module.exports = router;
