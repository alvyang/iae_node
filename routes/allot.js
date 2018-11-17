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
router.get("/downloadErrorAllots",function(req,res){
  var conf ={};
  conf.stylesXmlFile = "./utils/styles.xml";
  conf.name = "mysheet";
  conf.cols = [{caption:'调货日期',type:'string'
  },{caption:'产品编号',type:'string'
  },{caption:'调货单价',type:'string'
  },{caption:'调货数量',type:'string'
  },{caption:'调货单位',type:'string'
  },{caption:'错误信息',type:'string'
  }];
  var header = ['allot_time','product_code','allot_price','allot_number','hospital_name','errorMessage'];
  var d = JSON.parse(req.session.errorAllotsData);
  conf.rows = util.formatExcel(header,d);
  var result = nodeExcel.execute(conf);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats');
  res.setHeader("Content-Disposition", "attachment; filename=" + "error.xlsx");
  res.end(result, 'binary');
});
//导入销售记录
router.post("/importAllots",function(req,res){
  if(req.session.user[0].authority_code.indexOf("101") < 0){
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
      getAllotsData(req,output).then(allotsDrugsData=>{
        var allotsData= verData(req,allotsDrugsData);
        req.session.errorAllotsData = JSON.stringify(allotsData.errData);//错误的数据
        var sData = allotsData.correctData;//正确的数据
        var importMessage = "数据导入成功<a style='color:red;'>"+sData.length+"</a>条；导入错误<a style='color:red;'>"+allotsData.errData.length+"</a>条；"
        if(sData.length<1){
          res.json({"code":"000000",message:importMessage});
          return;
        }
        //指插入调货记录
        var insertAllotSql = "insert allot (allot_id,allot_time,allot_price,allot_number,allot_hospital,allot_drug_id,allot_money,"+
                             "allot_group_id,allot_create_userid,allot_create_time,allot_return_price,allot_return_money,allot_mack_price) values";
        //更新库存sql
        var updateStockSql = "update drugs d set d.stock = CASE d.product_id ";
        var updateProductId = "";
        //新增返款流水
        var bankDetailSql = "insert into bank_account_detail(account_detail_id,account_detail_deleta_flag,account_detail_group_id,"+
                            "flag_id,account_detail_create_time,account_detail_create_userid) VALUES ";
        for(var i = 0 ; i < sData.length;i++){
          //批量插入调货记录
          var allotId = uuid.v1();
          var createTime = new Date().format('yyyy-MM-dd');
          insertAllotSql+="('"+allotId+"','"+sData[i].allot_time+"','"+sData[i].allot_price+"','"+sData[i].allot_number+"',"+
                          "'"+sData[i].allot_hospital+"','"+sData[i].allot_drug_id+"','"+sData[i].allot_money+"',"+
                          "'"+sData[i].allot_group_id+"','"+sData[i].allot_create_userid+"','"+createTime+"',"+
                          "'"+sData[i].allot_return_price+"','"+sData[i].allot_return_money+"','"+sData[i].allot_mack_price+"'),";
          //更新库存sql
          var tempStock = sData[i].stock-sData[i].allot_number;
          updateProductId += "'"+sData[i].allot_drug_id+"',";
          updateStockSql+=" when '"+sData[i].allot_drug_id+"' then '"+tempStock+"' ";
          //批量插入返款流水
          bankDetailSql+="('"+uuid.v1()+"','1','"+sData[i].allot_group_id+"','allot_"+allotId+"','"+createTime+"','"+sData[i].allot_create_userid+"'),";
        };
        //批量插入调货记录sql
        insertAllotSql = insertAllotSql.substring(0,insertAllotSql.length-1);
        //批量更新库存sql
        updateProductId=updateProductId.substring(0,updateProductId.length-1);
        updateStockSql += "end where d.product_id in ("+updateProductId+")";
        //批量更新返款流水sql
        bankDetailSql = bankDetailSql.substring(0,bankDetailSql.length-1);

        var allot = DB.get("Allot");
        allot.executeSql(insertAllotSql,function(err,result){//批量插入调货记录sql
          if(err){
            logger.error(req.session.user[0].realname + "批量插入调货记录出错" + err);
          }
          allot.executeSql(updateStockSql,function(err,result){//批量更新库存sql
            if(err){
              logger.error(req.session.user[0].realname + "批量插入调货记录,批量更新库存出错" + err);
            }
          });
          allot.executeSql(bankDetailSql,function(err,result){//批量更新库存sql
            if(err){
              logger.error(req.session.user[0].realname + "批量插入调货记录,批量插入流水出错" + err);
            }
          });
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
    d.allot_time = sales[i].allot_time;
    d.allot_price = sales[i].allot_price;
    d.allot_number = sales[i].allot_number;
    d.hospital_name = sales[i].hospital_name;
    d.product_code = sales[i].product_code;
    d.allot_hospital = sales[i].hospital_id;
    d.allot_drug_id = sales[i].product_id;
    d.allot_policy_money = sales[i].allot_policy_money;
    d.allot_policy_contact_id = sales[i].allot_policy_contact_id;
    if(!d.allot_time || !d.allot_price ||!d.allot_number ||!d.hospital_name ||!d.product_code){
      d.errorMessage = "调货日期、产品编号、调货单价、调货数量、调货单位为必填项";
      errData.push(d);
      continue;
    }
    //验证价格
    var moneyReg = /^(([1-9]\d+(.[0-9]{1,})?|\d(.[0-9]{1,})?)|([-]([1-9]\d+(.[0-9]{1,})?|\d(.[0-9]{1,})?)))$/;
    if(!moneyReg.test(d.allot_price)){
      d.errorMessage = "调货单价填写错误";
      errData.push(d);
      continue;
    }
    //验证价格是否为正确的数字
    var moneyReg = /^(0|[1-9][0-9]*|-[1-9][0-9]*)$/;
    if(!moneyReg.test(d.allot_number)){
      d.errorMessage = "调货数量填写错误";
      errData.push(d);
      continue;
    }
    //验证编码是否存在
    if(!d.allot_hospital){
      d.errorMessage = "调货单位不存在";
      errData.push(d);
      continue;
    }
    //验证编码是否存在
    if(!d.allot_drug_id){
      d.errorMessage = "产品编码不存在";
      errData.push(d);
      continue;
    }
    d.allot_mack_price = sales[i].product_mack_price;
    d.product_type = sales[i].product_type;
    d.stock = sales[i].stock;
    d.allot_money = util.mul(d.allot_number,d.allot_price,2);
    d.allot_policy_contact_id = sales[i].allot_policy_contact_id?sales[i].allot_policy_contact_id:"";
    d.allot_return_price = sales[i].allot_policy_money?sales[i].allot_policy_money:"";
    d.allot_group_id = req.session.user[0].group_id;
    d.allot_create_userid = req.session.user[0].id;
    d.allot_return_money = d.allot_return_price?util.mul(d.allot_number,d.allot_return_price,2):"";
    d.allot_create_time = new Date().format('yyyy-MM-dd');
    d.allot_time = new Date(d.allot_time).format('yyyy-MM-dd');
    correctData.push(d);
  }
  return {
    correctData:correctData,
    errData:errData
  };
}
//根据上传的药品编码，查询药品信息。根据上传的销售单位名称，查询销售单位id
function getAllotsData(req,allots){
  //去空格处理
  var pdCode = "";
  for(var i = 1 ; i < allots.length;i++){
    pdCode+="\'"+allots[i][1]+"\',"
    for(var j = 0 ;j<allots[i].length ;j++){
      allots[i][j] = allots[i][j].trim();
    }
  }
  pdCode = pdCode.substring(0,pdCode.length-1);
  //拼接上传的产品编码，查询所有编码的药品
  var drugsSql = "select * from drugs d where d.delete_flag = '0' and d.group_id = '"+req.session.user[0].group_id+"' "+
                 "and d.product_code in ("+pdCode+") and d.product_type = '高打'";
  var drugs = DB.get("Drugs");
  return new Promise((resolve, reject) => {//查询所有药品编码
    drugs.executeSql(drugsSql,function(err,result){
      if(err){
        logger.error(req.session.user[0].realname + "导入调货记录，查询药品出错" + err);
         reject(err);
      }else{
        //将上传的数据，封闭成对象
        var allotsDrugsData=[];
        for(var i = 1 ;i < allots.length;i++){
          var d = arrayToObject(allots[i]);
          for(var j = 0 ; j<result.length;j++){
            if(d.product_code == result[j].product_code){
              result[j].allot_time=d.allot_time;
              result[j].allot_price=d.allot_price;
              result[j].allot_number=d.allot_number;
              result[j].hospital_name=d.hospital_name;
              var temp = JSON.stringify(result[j]);
              allotsDrugsData.push(JSON.parse(temp));
            }
          }

        }
        resolve(allotsDrugsData);
      }
    });
  }).then(allotsDrugsData => {//查询调货医院
    return new Promise((resolve, reject) => {
      var hospitals = DB.get("Hospitals");
      hospitals.where({//查询医院id
        group_id:req.session.user[0].group_id,
        delete_flag:0,
        hospital_type:'调货医院'
      },function(err,result){
        if(err){
          logger.error(req.session.user[0].realname + "导入调货数据，查询调货医院出错" + err);
          reject(err);
        }else{
          var hospitalId = "";
          for(var i = 0 ; i < allotsDrugsData.length;i++){
            for(var j = 0 ;j < result.length;j++){
              if(allotsDrugsData[i].hospital_name == result[j].hospital_name){
                allotsDrugsData[i].hospital_id = result[j].hospital_id;
                hospitalId+="\'"+result[j].hospital_id+"\',";
              }
            }
          }
          resolve({allotsDrugsData:allotsDrugsData,hospitalId:hospitalId});
        }
      });
    });
  }).then(data=>{//查询调货政策
    if(data.hospitalId){
      return new Promise((resolve, reject) => {
        var allotPolicy = DB.get("AllotPolicy");
        data.hospitalId=data.hospitalId.substring(0,data.hospitalId.length-1);
        var sql = "select * from allot_policy ap where ap.allot_hospital_id in ("+data.hospitalId+")";
        allotPolicy.executeSql(sql,function(err,result){
          if(err){
            logger.error(req.session.user[0].realname + "导入调货数据，查询调货政策出错" + err);
            reject(err);
          }else{
            for(var i = 0 ; i < data.allotsDrugsData.length;i++){
              for(var j = 0 ;j < result.length;j++){
                if(data.allotsDrugsData[i].hospital_id == result[j].allot_hospital_id &&
                   data.allotsDrugsData[i].product_id == result[j].allot_drug_id){
                   data.allotsDrugsData[i].allot_policy_money = result[j].allot_policy_money;
                   data.allotsDrugsData[i].allot_policy_contact_id = result[j].allot_policy_contact_id;
                }
              }
            }
            resolve(data.allotsDrugsData);
          }
        });
      });
    }else{
      resolve(data.allotsDrugsData);
    }
  });
}
//将数组转成对象
function arrayToObject(sales){
  return {
    allot_time:sales[0],
    product_code:sales[1],
    allot_price:sales[2],
    allot_number:sales[3],
    hospital_name:sales[4]
  }
}
//新增调货记录
router.post("/saveAllot",function(req,res){
  if(req.session.user[0].authority_code.indexOf("58") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  req.body.allot_time = new Date(req.body.allot_time).format("yyyy-MM-dd");
  if(req.body.allot_return_time){
    req.body.allot_return_time = new Date(req.body.allot_return_time).format("yyyy-MM-dd");
  }else{
    delete req.body.allot_return_time;
  }
  var productType = req.body.product_type;
  var stock = req.body.stock;
  var productId = req.body.allot_drug_id;
  var accountDetail = req.body.account_detail;
  var contactId = req.body.allot_policy_contact_id;
  var allotPolicyRemark = req.body.allot_policy_remark;
  delete req.body.allot_policy_contact_id;
  delete req.body.allot_policy_remark;
  delete req.body.account_detail;
  if(!req.body.allot_account_id){
      delete req.body.allot_account_id;
  }
  delete req.body.product_type;
  delete req.body.stock;
  var allot = DB.get("Allot");
  req.body.allot_group_id = req.session.user[0].group_id;
  req.body.allot_create_userid = req.session.user[0].id;
  req.body.allot_create_time = new Date();
  allot.insert(req.body,'allot_id',function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "新增调货记录出错" + err);
    }
    res.json({"code":"000000",message:result});
    //新增一条银行流水涨信息
    saveAllotAccountDetail(req,result,accountDetail);
    //更新调货医院--药品 政策信息
    updateAllotPolicy(req,contactId,allotPolicyRemark);
  });

  //添加完调货记录后，更新库存。
  if(productType == '高打'){
    var drugsStock = {
      product_id:productId,
      stock:stock-req.body.allot_number
    }
    var drugs = DB.get("Drugs");
    drugs.update(drugsStock,'product_id',function(err,result){
      if(err){
        logger.error(req.session.user[0].realname + "新增调货,更新库存出错" + err);
      }
    });
  }

});
//更新调货医院--药品 政策信息
function updateAllotPolicy(req,contactId,allotPolicyRemark){
  req.body.allot_return_price=req.body.allot_return_price?req.body.allot_return_price:"";
  allotPolicyRemark=allotPolicyRemark?allotPolicyRemark:"";
  contactId=contactId?contactId:"";
  var allotPolicy = DB.get("AllotPolicy");
  //联合主键，存在将删除更新为0。不存在插入
  var sql = "insert into allot_policy(allot_hospital_id,allot_drug_id,allot_policy_money,allot_policy_remark,allot_policy_contact_id";
      sql+=") values ('"+req.body.allot_hospital+"','"+req.body.allot_drug_id+"','"+req.body.allot_return_price+"','"+allotPolicyRemark+"','"+contactId+"'";
      sql +=") ON DUPLICATE KEY UPDATE allot_policy_money=VALUES(allot_policy_money),allot_policy_remark=VALUES(allot_policy_remark),allot_policy_contact_id=VALUES(allot_policy_contact_id)";
  allotPolicy.executeSql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "更新调货医院药品政策，出错" + err);
    }
  });
}
//添加调货，并直接返款，则添加流水账信息
function saveAllotAccountDetail(req,allotId,accountDetail){
  var bankaccountdetail={};
  if(req.body.allot_return_money != '' && req.body.allot_return_time){
    bankaccountdetail.account_detail_deleta_flag = '0';
    bankaccountdetail.account_id = req.body.allot_account_id;
  }else{
    bankaccountdetail.account_detail_deleta_flag = '1';
  }
  bankaccountdetail.account_detail_money = -req.body.allot_return_money;
  bankaccountdetail.account_detail_time = req.body.allot_return_time;
  bankaccountdetail.account_detail_mark = accountDetail;
  bankaccountdetail.account_detail_group_id = req.session.user[0].group_id;
  bankaccountdetail.flag_id = "allot_"+allotId;
  bankaccountdetail.account_detail_create_time = new Date();
  bankaccountdetail.account_detail_create_userid = req.session.user[0].id;
  var accountDetail = DB.get("AccountDetail");
  accountDetail.insert(bankaccountdetail,'account_detail_id',function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "添加返款新增流水出错" + err);
    }
  });
}
//编辑调货记录
router.post("/editAllot",function(req,res){
  if(req.session.user[0].authority_code.indexOf("59") > 0 || req.session.user[0].authority_code.indexOf("12303a00-cb9b-11e8-81ff-23b7b224f706") > 0){
    var allot = DB.get("Allot");
    req.body.allot_time = new Date(req.body.allot_time).format("yyyy-MM-dd");
    if(req.body.allot_return_time){
      req.body.allot_return_time = new Date(req.body.allot_return_time).format("yyyy-MM-dd");
    }else{
      delete req.body.allot_return_time;
    }
    var params = {
      allot_id:req.body.allot_id,
      allot_number:req.body.allot_number,
  		allot_time:req.body.allot_time,
  		allot_hospital:req.body.allot_hospital,
  		allot_money:req.body.allot_money,
  		allot_return_price:req.body.allot_return_price,
  		allot_return_money:req.body.allot_return_money,
  		allot_return_time:req.body.allot_return_time,
  		allot_return_flag:req.body.allot_return_flag
    }
    if(req.body.allot_account_id){
      params.allot_account_id = req.body.allot_account_id;
    }
    var contactId = req.body.allot_policy_contact_id;
    var allotPolicyRemark = req.body.allot_policy_remark;
    delete req.body.allot_policy_contact_id;
    delete req.body.allot_policy_remark;
    delete req.body.allot_create_time;
    allot.update(params,'allot_id',function(err,result){
      if(err){
        logger.error(req.session.user[0].realname + "修改调货记录出错" + err);
      }
      res.json({"code":"000000",message:null});
    });

    //添加完调货记录后，更新库存。
    if(req.body.product_type == '高打'){
      var drugsStock = {
        product_id:req.body.product_id,
        stock:req.body.stock-req.body.allot_number + parseInt(req.body.allot_number_temp)
      }
      var drugs = DB.get("Drugs");
      drugs.update(drugsStock,'product_id',function(err,result){
        if(err){
          logger.error(req.session.user[0].realname + "修改调货记录，更新库存出错" + err);
        }
      });
    }
    //更新调货医院--药品 政策信息
    updateAllotPolicy(req,contactId,allotPolicyRemark);
    //修改调货流水信息
    var bankaccountdetail={};
    if(req.body.allot_return_money != '' && req.body.allot_return_time){
      bankaccountdetail.account_detail_deleta_flag = '0';
      bankaccountdetail.account_id = req.body.allot_account_id;
    }else{
      bankaccountdetail.account_detail_deleta_flag = '1';
    }
    bankaccountdetail.account_detail_money = -req.body.allot_return_money;
    bankaccountdetail.account_detail_time = req.body.allot_return_time;
    bankaccountdetail.account_detail_mark = req.body.account_detail;
    bankaccountdetail.flag_id = "allot_"+req.body.allot_id;
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
//删除菜单
router.post("/deleteAllot",function(req,res){
  if(req.session.user[0].authority_code.indexOf("60") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var allot = DB.get("Allot");
  req.body.allot_delete_flag = 1;
  var productType = req.body.product_type;
  var stock = parseInt(req.body.stock);
  var productId = req.body.product_id;
  var allotNumber = parseInt(req.body.allot_number);
  delete req.body.product_type;
  delete req.body.stock;
  delete req.body.product_id;
  delete req.body.allot_number;
  allot.update(req.body,'allot_id',function(err,result){
    res.json({"code":"000000",message:null});
  });
  //添加完调货记录后，更新库存。
  if(productType == '高打' || productType == '高打(底价)'){
    var drugsStock = {
      product_id:productId,
      stock:stock+allotNumber
    }
    var drugs = DB.get("Drugs");
    drugs.update(drugsStock,'product_id',function(err,result){
      if(err){
        logger.error(req.session.user[0].realname + "删除调货记录出错" + err);
      }
    });
  }
});
//导出调货回款记录
router.post("/exportAllotRefund",function(req,res){
  if(req.session.user[0].authority_code.indexOf("f8037330-d802-11e8-a19c-cf0f6be47d2e") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  req.body.data = req.body;
  var allot = DB.get("Allot");
  var sql = getAllotSql(req);
  sql += " order by adpc.allot_time desc,adpc.allot_create_time desc";
  allot.executeSql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "导出调货回款记录出错" + err);
    }
    var conf ={};
    conf.stylesXmlFile = "./utils/styles.xml";
    conf.name = "mysheet";
    conf.cols = [{
        caption:'调货时间',
        type:'string',
        beforeCellWrite:function(row, cellData){
          return new Date(cellData).format('yyyy-MM-dd');
        }
    },{caption:'调货单位',type:'string'
    },{caption:'产品编码',type:'string'
    },{caption:'产品名称',type:'string'
    },{caption:'产品规格',type:'string'
    },{caption:'生产厂家',type:'string'
    },{caption:'单位',type:'string'
    },{caption:'商业',type:'string'
    },{caption:'调货数量',type:'number'
    },{caption:'中标价',type:'number'
    },{caption:'调货金额',type:'number'
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
    var header = ['allot_time', 'hospital_name', 'product_code', 'product_common_name', 'product_specifications',
                  'product_makesmakers','product_unit','business_name','allot_number','allot_price','allot_money',
                  'allot_return_price','allot_return_money','allot_return_time','allot_policy_remark'];
    conf.rows = util.formatExcel(header,result);
    var result = nodeExcel.execute(conf);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats');
    res.setHeader("Content-Disposition", "attachment; filename=" + "Report.xlsx");
    res.end(result, 'binary');
  });
});
//导出调货记录
router.post("/exportAllot",function(req,res){
  if(req.session.user[0].authority_code.indexOf("61f34560-d801-11e8-b0cc-65c20b1efa48") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  req.body.data = req.body;
  var allot = DB.get("Allot");
  var sql = getAllotSql(req);
  sql += " order by adpc.allot_time desc,adpc.allot_create_time desc";
  allot.executeSql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "导出调货记录出错" + err);
    }
    var conf ={};
    conf.stylesXmlFile = "./utils/styles.xml";
    conf.name = "mysheet";
    conf.cols = [{
        caption:'调货时间',
        type:'string',
        beforeCellWrite:function(row, cellData){
          return new Date(cellData).format('yyyy-MM-dd');
        }
    },{caption:'调货单位',type:'string'
    },{caption:'产品编码',type:'string'
    },{caption:'产品名称',type:'string'
    },{caption:'产品规格',type:'string'
    },{caption:'生产厂家',type:'string'
    },{caption:'单位',type:'string'
    },{caption:'商业',type:'string'
    },{caption:'调货数量',type:'number'
    },{caption:'中标价',type:'number'
    },{caption:'调货金额',type:'number'
    }];
    var header = ['allot_time', 'hospital_name', 'product_code', 'product_common_name', 'product_specifications',
                  'product_makesmakers','product_unit','business_name','allot_number','allot_price','allot_money'];
    conf.rows = util.formatExcel(header,result);
    var result = nodeExcel.execute(conf);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats');
    res.setHeader("Content-Disposition", "attachment; filename=" + "Report.xlsx");
    res.end(result, 'binary');
  });
});
//获取调货列表
router.post("/getAllot",function(req,res){
  if(req.session.user[0].authority_code.indexOf("61") > 0  || req.session.user[0].authority_code.indexOf("130627a0-cb9b-11e8-81ff-23b7b224f706") > 0){
    var allot = DB.get("Allot");
    var sql = getAllotSql(req);
    allot.countBySql(sql,function(err,result){//查询调货总数
      if(err){
        logger.error(req.session.user[0].realname + "查询调货列表，查询调货总数出错" + err);
      }
      var numSql = "select sum(num.allot_return_money) as returnMoney,sum(num.allot_money) as allotMoney from ( " + sql + " ) num";
      allot.executeSql(numSql,function(err,m){//查询调货应返金额
        if(err){
          logger.error(req.session.user[0].realname + "查询调货列表，计算返款金额出错" + err);
        }
        req.body.page.returnMoney = m && m[0].returnMoney?m[0].returnMoney.toFixed(2):0;
        req.body.page.allotMoney = m && m[0].allotMoney?m[0].allotMoney.toFixed(2):0;
        req.body.page.totalCount = result;
        req.body.page.totalPage = Math.ceil(req.body.page.totalCount / req.body.page.limit);
        sql += " order by adpc.allot_time desc,adpc.allot_create_time desc limit " + req.body.page.start + "," + req.body.page.limit + "";
        allot.executeSql(sql,function(err,result){
          if(err){
            logger.error(req.session.user[0].realname + "查询调货列表出错" + err);
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
function getAllotSql(req){
  //连接查询药品和药品相关商业
  var sql = "select dbus.*,bus.business_name from drugs dbus left join business bus on dbus.product_business = bus.business_id";
  //连接查询调货记录和医院信息
  var allotHopitalSql = "select ah.*,h.hospital_name from allot ah left join hospitals h on ah.allot_hospital = h.hospital_id"
  sql = "select * from ("+allotHopitalSql+") a left join ("+sql+") d on a.allot_drug_id = d.product_id where a.allot_delete_flag = '0' and a.allot_group_id = '"+req.session.user[0].group_id+"' ";
  //数据权限
  if(req.session.user[0].data_authority == "2"){
    sql += "and a.allot_create_userid = '"+req.session.user[0].id+"'";
  }
  if(req.body.data.product_makesmakers){
    sql += "and d.product_makesmakers like '%"+req.body.data.product_makesmakers+"%'";
  }
  if(req.body.data.productCommonName){
    sql += " and (d.product_common_name like '%"+req.body.data.productCommonName+"%' or d.product_name_pinyin like '%"+req.body.data.productCommonName+"%')";
  }
  if(req.body.data.allot_hospital){
    sql += " and a.allot_hospital = '"+req.body.data.allot_hospital+"'"
  }
  if(req.body.data.product_code){
    sql += " and d.product_code = '"+req.body.data.product_code+"'"
  }
  if(req.body.data.business){
    sql += " and d.product_business = '"+req.body.data.business+"'"
  }
  if(req.body.data.allot_time){
    var start = new Date(req.body.data.allot_time[0]).format("yyyy-MM-dd");
    var end = new Date(req.body.data.allot_time[1]).format("yyyy-MM-dd");
    sql += " and DATE_FORMAT(a.allot_time,'%Y-%m-%d') >= '"+start+"' and DATE_FORMAT(a.allot_time,'%Y-%m-%d') <= '"+end+"'";
  }
  if(req.body.data.allot_return_flag){
    sql += req.body.data.allot_return_flag=="已回"?" and a.allot_return_time is not null":" and a.allot_return_time is null";
  }
  //连接查询调货 药品对应调货单位的政策信息
  sql = "select adp.*,ap.allot_policy_money,ap.allot_policy_remark,ap.allot_policy_contact_id from ("+sql+") adp left join allot_policy ap on adp.allot_drug_id = ap.allot_drug_id and adp.allot_hospital = ap.allot_hospital_id"
  if(req.body.data.contactId){
    sql+=" where ap.allot_policy_contact_id = '"+req.body.data.contactId+"'";
  }
  sql = "select adpc.*,cont.contacts_name from ("+sql+") adpc left join contacts cont on adpc.allot_policy_contact_id = cont.contacts_id"
  return sql;
}
//分组查询，获取备注
router.post("/getHospitals",function(req,res){
  var allot = DB.get("Allot");
  var sql = "select a.allot_hospital from allot a where a.allot_delete_flag = '0' and a.allot_group_id = '"+req.session.user[0].group_id+"' and a.allot_hospital is not null and a.allot_hospital !='' group by a.allot_hospital"
  allot.executeSql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "分组查询医院出错" + err);
    }
    res.json({"code":"000000",message:result});
  });
});
//根据药品id和医院id 查询调货政策
router.post("/getAllotPolicy",function(req,res){
  var allotPolicy = DB.get("AllotPolicy");
  var sql = "select * from allot_policy ap where ap.allot_hospital_id = '"+req.body.hospitalId+"' and ap.allot_drug_id = '"+req.body.drugId+"'";
  allotPolicy.executeSql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "分组查询医院出错" + err);
    }
    res.json({"code":"000000",message:result});
  });
});
module.exports = router;
