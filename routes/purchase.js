var express = require("express");
var nodeExcel = require('excel-export');
var logger = require('../utils/logger');
var fs = require('fs');
var util= require('../utils/global_util.js');
var router = express.Router();

//新增采购记录
router.post("/savePurchases",function(req,res){
  if(req.session.user[0].authority_code.indexOf("53") < 0){
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
    purchases_id:id,
  }
  if(req.body.make_money_time){
    var rst = util.getReturnTime(new Date(req.body.make_money_time),returnTime.product_return_time_type,returnTime.product_return_time_day,returnTime.product_return_time_day_num);
    m.refunds_should_time = rst.format("yyyy-MM-dd");
  }
  if(productReturnMoney){
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
  if(req.session.user[0].authority_code.indexOf("54") < 0){
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
  }
  purchase.update(params,'purchase_id',function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "修改采购记录出错" + err);
    }
    //更新高打返款记录金额
    updateRefundsPurchase(req);
    res.json({"code":"000000",message:null});
  });

  if(req.body.storage_time || req.body.storage_time_temp){//入库更新库存
    var stock = 0;
    if(req.body.storage_time_temp && req.body.storage_time){
      stock = -parseInt(req.body.purchase_number_temp)+parseInt(req.body.purchase_number);
    }else if(req.body.storage_time_temp && !req.body.storage_time){
      stock = -parseInt(req.body.purchase_number);
    }else if(!req.body.storage_time_temp && req.body.storage_time){
      stock = parseInt(req.body.purchase_number);
    }

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
});
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
  if(req.body.product_return_money){
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
  if(req.session.user[0].authority_code.indexOf("55") < 0){
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
  if(req.session.user[0].authority_code.indexOf("57") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var purchase = DB.get("Purchase");
  req.body.data = req.body;
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
    res.setHeader('Content-Type', 'application/vnd.openxmlformats');
    res.setHeader("Content-Disposition", "attachment; filename=" + "Report.xlsx");
    res.end(result, 'binary');
  });
});
//获取备货列表
router.post("/getPurchases",function(req,res){
  var noDate = new Date();
  if(req.session.user[0].authority_code.indexOf("56") < 0){
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
  var sql = "select p.purchase_id,p.time,p.purchase_number,p.purchase_money,p.purchase_mack_price,p.purchase_price,p.batch_number,"+
            "p.puchase_gross_rate,p.make_money_time,p.send_out_time,p.storage_time,p.remark,bus.business_name,c.contacts_name,"+
            "d.product_id,d.stock,d.product_code,d.product_type,d.buyer,d.product_common_name,"+
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
  if(req.body.data.productCommonName){
    sql += " and (d.product_common_name like '%"+req.body.data.productCommonName+"%' or d.product_name_pinyin like '%"+req.body.data.productCommonName+"%')";
  }
  if(req.body.data.contactId){
    sql += " and d.contacts_id = '"+req.body.data.contactId+"'"
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
  if(req.body.data.remark){
    sql += " and p.remark = '"+req.body.data.remark+"'"
  }
  if(req.body.data.time){
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
