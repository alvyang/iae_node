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
router.get("/downloadErrorAllocation",function(req,res){
  var conf ={};
  conf.stylesXmlFile = "./utils/styles.xml";
  conf.name = "mysheet";
  conf.cols = [{caption:'调拨日期',type:'string',
  beforeCellWrite:function(row, cellData){
    return new Date(cellData).format('yyyy-MM-dd');
  }
  },{caption:'调拨前产品编号',type:'string'
  },{caption:'调拨前产品批号',type:'string'
  },{caption:'该批号入库时间（高打品种必填）',type:'string'
  },{caption:'调拨后产品编码',type:'number'
  },{caption:'调拨数量',type:'number'
  },{caption:'错误信息',type:'string'
  }];
  var header = ['allocation_time','allocation_front_product_code','batch_number','storage_time','allocation_after_product_code','allocation_number','errorMessage'];
  var d = JSON.parse(req.session.errorAllocationData);
  conf.rows = util.formatExcel(header,d);
  var result = nodeExcel.execute(conf);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats');
  res.setHeader("Content-Disposition", "attachment; filename=" + "error.xlsx");
  res.end(result, 'binary');
});
//导入调拨记录
router.post("/importAllocation",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",177,") < 0){
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
      getAllocationData(req,output).then(allocation=>{
        var allocationData= verData(req,allocation);
        req.session.errorAllocationData = null;
        req.session.errorAllocationData = JSON.stringify(allocationData.errData);//错误的数据
        var aData = allocationData.correctData;//正确的数据
        var importMessage = "数据导入成功<a style='color:red;'>"+aData.length+"</a>条；导入错误<a style='color:red;'>"+allocationData.errData.length+"</a>条；"
        if(aData.length<1){
          var message = req.session.user[0].realname+"导入调拨记录，数据导入错误"+allocationData.errData.length+"条；";
          util.saveLogs(req.session.user[0].group_id,"-","-",message);
          res.json({"code":"000000",message:importMessage});
          return;
        }

        //指插入调货记录
        var insertAllocationSql = "insert allocation (allocation_id,allocation_time,allocation_front_drug_id,allocation_front_business_id,allocation_after_drug_id,"+
                             "allocation_after_business_id,allocation_front_product_code,allocation_after_product_code,"+
                             "allocation_front_business_name,allocation_after_business_name,allocation_number,allocation_group_id,"+
                            "allocation_create_time,allocation_purchase_id,allocation_create_userid,allocation_batch_number) values ";
        for(var i = 0 ; i < aData.length ; i++){
          insertAllocationSql+="('"+aData[i].allocation_id+"','"+aData[i].allocation_time+"','"+aData[i].allocation_front_drug_id+"','"+aData[i].allocation_front_business_id+"',"+
                               "'"+aData[i].allocation_after_drug_id+"','"+aData[i].allocation_after_business_id+"','"+aData[i].allocation_front_product_code+"',"+
                               "'"+aData[i].allocation_after_product_code+"','"+aData[i].allocation_front_business_name+"','"+aData[i].allocation_after_business_name+"',"+
                               "'"+aData[i].allocation_number+"','"+aData[i].allocation_group_id+"','"+aData[i].allocation_create_time+"','"+aData[i].allocation_purchase_id+"',"+
                               "'"+aData[i].allocation_create_userid+"','"+aData[i].batch_number+"'),";
        }

        var allocation = DB.get("Allocation");
        insertAllocationSql = insertAllocationSql.substring(0,insertAllocationSql.length-1);
        allocation.executeSql(insertAllocationSql,function(err,result){//批量插入调货记录sql
          if(err){
            logger.error(req.session.user[0].realname + "批量插入调拨记录出错" + err);
          }else{
            //批量更新库存
            updateStockBatch(req,aData);
          }
          //添加日志
          var message = req.session.user[0].realname+"导入调拨记录，数据导入成功"+aData.length+"条；导入错误"+allocationData.errData.length+"条；";
          util.saveLogs(req.session.user[0].group_id,"-","-",message);
          res.json({"code":"000000",message:importMessage});
        });
      })
    });
  });
});
function updateStockBatch(req,aData){
  //更新库存
  var batchStock = DB.get("BatchStock");
  var  getStock = "select * from batch_stock bs where bs.batch_stock_number > 0 and "+
                  "bs.tag_type_group_id = '"+req.session.user[0].group_id+"' and bs.tag_type_delete_flag = '0' ";
  batchStock.executeSql(getStock,function(err,result){//查询现有库存
    if(err){
      logger.error(req.session.user[0].realname + "更新批次库存，查询现库存出错" + err);
    }
    for(var i = 0 ; i < aData.length; i++){
      for(var j = 0 ; j < result.length;j++){
        if(result[j].batch_stock_drug_id == aData[i].allocation_front_drug_id &&
           result[j].batch_stock_purchase_id == aData[i].allocation_purchase_id ){
          aData[i].frontStock = parseInt(result[j].batch_stock_number) - parseInt(aData[i].allocation_number);
          aData[i].batch_number = result[j].batch_number;
          aData[i].batch_stock_time = new Date(result[j].batch_stock_time).format("yyyy-MM-dd");
        }
        if(result[j].batch_stock_drug_id == aData[i].allocation_after_drug_id){
          aData[i].afterStock = parseInt(result[j].batch_stock_number) + parseInt(aData[i].allocation_number);
        }
      }
      aData[i].afterStock=aData[i].afterStock?aData[i].afterStock:aData[i].allocation_number;
    }
    //联合主键，更新库存
    var stockSql = "insert into batch_stock values ";
    for(var i = 0 ; i < aData.length ; i++){
      stockSql+="('"+aData[i].allocation_front_drug_id+"','"+aData[i].allocation_purchase_id+"','"+aData[i].frontStock+"','"+aData[i].batch_stock_time+"','"+aData[i].batch_number+"','0','"+req.session.user[0].group_id+"'),"+
                "('"+aData[i].allocation_after_drug_id+"','"+aData[i].allocation_purchase_id+"','"+aData[i].afterStock+"','"+aData[i].batch_stock_time+"','"+aData[i].batch_number+"','0','"+req.session.user[0].group_id+"'),";
    }
    stockSql = stockSql.substring(0,stockSql.length-1)+" ";
    stockSql += " ON DUPLICATE KEY UPDATE batch_stock_number=VALUES(batch_stock_number),batch_number=VALUES(batch_number),batch_stock_time=VALUES(batch_stock_time);"
    batchStock.executeSql(stockSql,function(err,result){
      if(err){
        logger.error(req.session.user[0].realname + "商业调拨,更新批次库存出错" + err);
      }
    });
  });
}
function verData(req,d){
  var correctData=[];
  var errData=[];
  for(var i = 0 ; i < d.length ; i++){
    if(util.isEmpty(d[i].allocation_time) || util.isEmpty(d[i].allocation_front_product_code) ||util.isEmpty(d[i].allocation_after_product_code) ||
        util.isEmpty(d[i].batch_number) ||util.isEmpty(d[i].storage_time)||util.isEmpty(d[i].allocation_number)){
      d[i].errorMessage = "调拨日期、调拨前产品编号、调拨前产品批号、该批号入库时间、调拨后产品编码、调拨数量为必填项";
      errData.push(d[i]);
      continue;
    }
    if(util.isEmpty(d[i].allocation_front_drug_id)){
      d[i].errorMessage = "调拨前产品编号不存在";
      errData.push(d[i]);
      continue;
    }
    if(util.isEmpty(d[i].allocation_purchase_id)){
      d[i].errorMessage = "调拨前产品编号，批号/入库时间错误或库存不足";
      errData.push(d[i]);
      continue;
    }
    if(util.isEmpty(d[i].allocation_after_drug_id)){
      d[i].errorMessage = "调拨后产品编号不存在";
      errData.push(d[i]);
      continue;
    }
    if(d[i].allocation_front_drug_id == d[i].allocation_after_drug_id){
      d[i].errorMessage = "调拨前产品编号与调拨后产品编码相同";
      errData.push(d[i]);
      continue;
    }
    if(d[i].product_common_name != d[i].product_common_name1 ||
       d[i].product_specifications != d[i].product_specifications1 ||
       d[i].product_makesmakers != d[i].product_makesmakers1 ){
       d[i].errorMessage = "调拨前产品编号与调拨后产品编码，不是同一品种";
       errData.push(d[i]);
       continue;
    }
    //验证价格是否为正确的数字
    var moneyReg = /^(0|[1-9][0-9]*|-[1-9][0-9]*)$/;
    if(!moneyReg.test(d[i].allocation_number)){
      d[i].errorMessage = "调拨数量填写错误";
      errData.push(d[i]);
      continue;
    }
    d[i].allocation_time = new Date(d[i].allocation_time).format("yyyy-MM-dd");
    d[i].allocation_group_id = req.session.user[0].group_id;
    var createTime = new Date();
    createTime.setTime(createTime.getTime()+i*1000);
    d[i].allocation_create_time = createTime.format('yyyy-MM-dd hh:mm:ss');
    d[i].allocation_create_userid = req.session.user[0].id;
    d[i].allocation_front_business_name = d[i].allocation_front_business_name?d[i].allocation_front_business_name:"";
    d[i].allocation_after_business_name = d[i].allocation_after_business_name?d[i].allocation_after_business_name:"";
    d[i].allocation_id = uuid.v1();
    correctData.push(d[i]);
  }
  return {
    correctData:correctData,
    errData:errData
  };
}
function getAllocationData(req,allocation){
  //去空格处理
  var pdCode = "";
  for(var i = 1 ; i < allocation.length;i++){
    pdCode+="\'"+allocation[i][4]+"\',"+"\'"+allocation[i][1]+"\',";
    for(var j = 0 ;j<allocation[i].length ;j++){
      allocation[i][j] = allocation[i][j].trim();
    }
  }
  pdCode = pdCode.substring(0,pdCode.length-1);

  var drugsSql = "select * from drugs d where d.delete_flag = '0' and d.group_id = '"+req.session.user[0].group_id+"' "+
                 "and d.product_code in ("+pdCode+") and d.product_type = '高打'";
  var drugs = DB.get("Drugs");
  return new Promise((resolve, reject) => {//查询所有药品编码
    drugs.executeSql(drugsSql,function(err,result){
      if(err){
        logger.error(req.session.user[0].realname + "导入调拨记录，查询药品出错" + err);
         reject(err);
      }else{
        //将上传的数据，封闭成对象
        var allocationDrugsData=[];
        for(var i = 1 ;i < allocation.length;i++){
          var d = arrayToObject(allocation[i]);
          for(var j = 0 ; j<result.length;j++){
            if(d.allocation_front_product_code == result[j].product_code){
              d.allocation_front_drug_id = result[j].product_id;
              d.allocation_front_business_id = result[j].product_business;
              d.product_common_name = result[j].product_common_name;
              d.product_specifications = result[j].product_specifications;
              d.product_makesmakers = result[j].product_makesmakers;
            }
            if(d.allocation_after_product_code == result[j].product_code){
              d.allocation_after_drug_id = result[j].product_id;
              d.allocation_after_business_id = result[j].product_business;
              d.product_common_name1 = result[j].product_common_name;
              d.product_specifications1 = result[j].product_specifications;
              d.product_makesmakers1 = result[j].product_makesmakers;
            }
          }
          allocationDrugsData.push(d);
        }
        resolve(allocationDrugsData);
      }
    });
  }).then(data=>{//查询批次库存
    return new Promise((resolve, reject) => {
      var batchStock = DB.get("BatchStock");
      var sql = "select bs.* from batch_stock bs "+
                "where  bs.tag_type_delete_flag = '0' and bs.tag_type_group_id = '"+req.session.user[0].group_id+"' "+
                "and bs.batch_stock_number > 0 ";
      batchStock.executeSql(sql,function(err,result){
        if(err){
          logger.error(req.session.user[0].realname + "导入调拨记录，查询批次库存" + err);
        }
        for(var i = 0 ; i <data.length; i++ ){
          for(var j = 0 ; j < result.length;j++){
            var tData = new Date(result[j].batch_stock_time).format("yyyy-MM-dd");
            var tDataImport = new Date(data[i].storage_time).format("yyyy-MM-dd");
            if(result[j].batch_stock_drug_id == data[i].allocation_front_drug_id &&
               result[j].batch_number == data[i].batch_number &&
               tData == tDataImport
              ){
              data[i].allocation_purchase_id = result[j].batch_stock_purchase_id;
            }
          }
        }
        resolve(data);
      });
    });
  }).then(data=>{
    return new Promise((resolve, reject) => {
      var business = DB.get("Business");
      var sql = "select * from business b where b.business_group_id = '"+req.session.user[0].group_id+"' ";
      business.executeSql(sql,function(err,result){
        if(err){
          logger.error(req.session.user[0].realname + "导入调拨记录，查询商业" + err);
        }
        for(var i = 0 ; i <data.length; i++ ){
          for(var j = 0 ; j < result.length;j++){
            if(data[i].allocation_front_business_id == result[j].business_id){
              data[i].allocation_front_business_name = result[j].business_name;
            }
            if(data[i].allocation_after_business_id == result[j].business_id){
              data[i].allocation_after_business_name = result[j].business_name;
            }
          }
        }
        resolve(data);
      });
    });
  });
}
function arrayToObject(allocation){
  return {
    allocation_time:allocation[0],
    allocation_front_product_code:allocation[1],
    batch_number:allocation[2],
    storage_time:allocation[3],
    allocation_after_product_code:allocation[4],
    allocation_number:allocation[5]
  }
}
//导出调拨记录
router.post("/exportAllocation",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",176,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var findParam = JSON.stringify(req.body);
  req.body.data = JSON.parse(findParam);
  var allocation = DB.get("Allocation");
  var sql = getAllocationListSql(req);
  sql += " order by a.allocation_time desc,a.allocation_create_time desc";
  allocation.executeSql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "导出调拨记录出错" + err);
    }
    var conf ={};
    conf.stylesXmlFile = "./utils/styles.xml";
    conf.name = "mysheet";
    conf.cols = [{
        caption:'调拨时间',
        type:'string',
        beforeCellWrite:function(row, cellData){
          return new Date(cellData).format('yyyy-MM-dd');
        }
    },{caption:'产品通用名',type:'string'
    },{caption:'产品规格',type:'string'
    },{caption:'生产厂家',type:'string'
    },{caption:'调拨前商业名称',type:'string'
    },{caption:'调拨前产品编码',type:'string'
    },{caption:'调拨后商业名称',type:'string'
    },{caption:'调拨后产品编码',type:'string'
    },{caption:'批号',type:'string'
    },{caption:'调拨数量',type:'number'
    },{caption:'备注',type:'string'
    }];
    var header = ['allocation_time', 'product_common_name', 'product_specifications', 'product_makesmakers',
                  'allocation_front_business_name','allocation_front_product_code','allocation_after_business_name',
                  'allocation_after_product_code','allocation_batch_number','allocation_number','allocation_remark'];
    conf.rows = util.formatExcel(header,result);
    var result = nodeExcel.execute(conf);
    var message = req.session.user[0].realname+"导出调拨记录。"+conf.rows.length+"条";
    util.saveLogs(req.session.user[0].group_id,"-",findParam,message);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats');
    res.setHeader("Content-Disposition", "attachment; filename=" + "Report.xlsx");
    res.end(result, 'binary');
  });
});
//获取备货列表
router.post("/getAllocationList",function(req,res){
  var noDate = new Date();
  if(req.session.user[0].authority_code.indexOf(",175,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var allocation = DB.get("Allocation");
  var sql = getAllocationListSql(req);
  allocation.countBySql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "查询调拨记录，查询总数出错" + err);
    }
    req.body.page.totalCount = result;
    req.body.page.totalPage = Math.ceil(req.body.page.totalCount / req.body.page.limit);
    sql += " order by a.allocation_time desc,a.allocation_create_time desc limit " + req.body.page.start + "," + req.body.page.limit + "";
    allocation.executeSql(sql,function(err,result){
      if(err){
        logger.error(req.session.user[0].realname + "查询调拨记录出错" + err);
      }
      req.body.page.data = result;
      logger.error(req.session.user[0].realname + "purchase-getPurchases运行时长" + (noDate.getTime()-new Date().getTime()));
      res.json({"code":"000000",message:req.body.page});
    });
  });
});
function getAllocationListSql(req){
  var sql = "select * from allocation a left join drugs d on a.allocation_front_drug_id = d.product_id "+
            "where a.allocation_delete_flag = '0' and a.allocation_group_id = '"+req.session.user[0].group_id+"' ";
  //数据权限
  if(req.session.user[0].data_authority == "2"){
    sql += "and a.allocation_create_userid = '"+req.session.user[0].id+"' ";
  }
  if(!util.isEmpty(req.body.data.businessFront)){
    sql += "and a.allocation_front_business_id = '"+req.body.data.businessFront+"' ";
  }
  if(!util.isEmpty(req.body.data.businessAfter)){
    sql += "and a.allocation_after_business_id = '"+req.body.data.businessAfter+"' ";
  }
  if(req.body.data.allocation_time){
    var start = new Date(req.body.data.allocation_time[0]).format("yyyy-MM-dd");
    var end = new Date(req.body.data.allocation_time[1]).format("yyyy-MM-dd");
    sql += "and DATE_FORMAT(a.allocation_time,'%Y-%m-%d') >= '"+start+"' and DATE_FORMAT(a.allocation_time,'%Y-%m-%d') <= '"+end+"' ";
  }
  if(!util.isEmpty(req.body.data.productCommonName)){
    sql += "and d.product_common_name like '%"+req.body.data.productCommonName+"%'";
  }
  return sql;
}

//新增调货记录
router.post("/saveAllocation",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",172,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var allocation = DB.get("Allocation");
  req.body.allocation_group_id = req.session.user[0].group_id;
  req.body.allocation_create_userid = req.session.user[0].id;
  req.body.allocation_create_time = new Date();
  req.body.allocation_time = new Date(req.body.allocation_time).format("yyyy-MM-dd");
  allocation.insert(req.body,'allocation_id',function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "新增调拨记录出错" + err);
    }
    res.json({"code":"000000",message:result});
    //更新库存
    updateStock(req);
    var message = req.session.user[0].realname+"新增调拨记录。id："+result
    util.saveLogs(req.session.user[0].group_id,"-",JSON.stringify(req.body),message);
  });
});
//新增调货记录
router.post("/deleteAllocation",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",172,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var allocation = DB.get("Allocation");
  req.body.allocation_delete_flag = '1';
  allocation.update(req.body,'allocation_id',function(err,result){
    updateStock(req);
    res.json({"code":"000000",message:null});
    var message = req.session.user[0].realname+"删除调拨记录。id："+req.body.allocation_id;
    util.saveLogs(req.session.user[0].group_id,"-","-",message);
  });
});
//修改调拨记录
router.post("/editAllocation",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",173,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var allocation = DB.get("Allocation");
  var params={
    allocation_id:req.body.allocation_id,
    allocation_number:req.body.allocation_number,
    allocation_remark:req.body.allocation_remark,
    allocation_time:new Date(req.body.allocation_time).format("yyyy-MM-dd")
  }
  allocation.update(params,'allocation_id',function(err,result){
    req.body.allocation_number = req.body.allocation_number - req.body.allocation_number_temp;
    updateStock(req);
    res.json({"code":"000000",message:null});
    var message = req.session.user[0].realname+"修改调拨记录。id："+req.body.allocation_id;
    util.saveLogs(req.session.user[0].group_id,req.body.front_allocation_message,JSON.stringify(params),message);
  });
});

//更新库存
function updateStock(req){
  //更新库存
  var batchStock = DB.get("BatchStock");
  var  getStock = "select bs.batch_stock_drug_id,bs.batch_stock_number,bs.batch_number,bs.batch_stock_time from batch_stock bs where "+
                  "bs.batch_stock_purchase_id = '"+req.body.allocation_purchase_id+"' "+
                  "and bs.tag_type_group_id = '"+req.session.user[0].group_id+"' and bs.tag_type_delete_flag = '0' ";
  batchStock.executeSql(getStock,function(err,result){//查询现有库存
    if(err){
      logger.error(req.session.user[0].realname + "更新批次库存，查询现库存出错" + err);
    }
    for(var i = 0 ; i < result.length;i++){
      if(result[i].batch_stock_drug_id == req.body.allocation_front_drug_id){
        req.body.frontStock = parseInt(result[i].batch_stock_number) - parseInt(req.body.allocation_number);
        req.body.batch_number = result[i].batch_number;
        req.body.batch_stock_time = new Date(result[i].batch_stock_time).format("yyyy-MM-dd");
      }
      if(result[i].batch_stock_drug_id == req.body.allocation_after_drug_id){
        req.body.afterStock = parseInt(result[i].batch_stock_number) + parseInt(req.body.allocation_number);
      }
    }
    req.body.afterStock=req.body.afterStock?req.body.afterStock:req.body.allocation_number;

    //联合主键，更新库存
    var stockSql = "insert into batch_stock values "+
                   "('"+req.body.allocation_front_drug_id+"','"+req.body.allocation_purchase_id+"','"+req.body.frontStock+"','"+req.body.batch_stock_time+"','"+req.body.batch_number+"','0','"+req.session.user[0].group_id+"'),"+
                   "('"+req.body.allocation_after_drug_id+"','"+req.body.allocation_purchase_id+"','"+req.body.afterStock+"','"+req.body.batch_stock_time+"','"+req.body.batch_number+"','0','"+req.session.user[0].group_id+"') ";
    stockSql += " ON DUPLICATE KEY UPDATE tag_type_delete_flag=VALUES(tag_type_delete_flag),batch_stock_number=VALUES(batch_stock_number),batch_number=VALUES(batch_number),batch_stock_time=VALUES(batch_stock_time);"
    batchStock.executeSql(stockSql,function(err,result){
      if(err){
        logger.error(req.session.user[0].realname + "商业调拨,更新批次库存出错" + err);
      }
    });
  });
}
//查询报损的批次库存记录
router.post("/getAllocationDrugs",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",114,") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var batchStock = DB.get("BatchStock");
  var sql = "select d.*,bs.*,bus.business_name,c.contacts_name from drugs d left join batch_stock bs on d.product_id = bs.batch_stock_drug_id "+
            "left join contacts c on d.contacts_id = c.contacts_id "+
            "left join business bus on d.product_business = bus.business_id "+
            " where bs.tag_type_delete_flag = '0' and bs.tag_type_group_id = '"+req.session.user[0].group_id+"' "+
            " and d.delete_flag = '0' and d.group_id = '"+req.session.user[0].group_id+"' and bs.batch_stock_number != 0";
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
  if(!util.isEmpty(req.body.data.time)){
    var start = new Date(req.body.data.time[0]).format("yyyy-MM-dd");
    var end = new Date(req.body.data.time[1]).format("yyyy-MM-dd");
    sql += " and DATE_FORMAT(bs.batch_stock_time,'%Y-%m-%d') >= '"+start+"' and DATE_FORMAT(bs.batch_stock_time,'%Y-%m-%d') <= '"+end+"'";
  }
  batchStock.countBySql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "报损，查询批次库存，查询总数出错" + err);
    }
    req.body.page.totalCount = result;
    req.body.page.totalPage = Math.ceil(req.body.page.totalCount / req.body.page.limit);
    sql += " order by bs.batch_stock_time desc limit " + req.body.page.start + "," + req.body.page.limit + "";
    batchStock.executeSql(sql,function(err,result){
      if(err){
        logger.error(req.session.user[0].realname + "报损，查询批次库存" + err);
      }
      req.body.page.data = result;
      res.json({"code":"000000",message:req.body.page});
    });
  });

});
module.exports = router;
