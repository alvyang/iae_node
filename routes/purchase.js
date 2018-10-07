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
  delete req.body.stock;
  var purchase = DB.get("Purchase");
  req.body.group_id = req.session.user[0].group_id;
  purchase.insert(req.body,'purchase_id',function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "新增采购记录出错" + err);
    }
    res.json({"code":"000000",message:result});
  });

  if(req.body.storage_time){//入库更新库存
    var drugsStock = {
      product_id:req.body.drug_id,
      stock:stock+parseInt(req.body.purchase_number)
    }
    var drugs = DB.get("Drugs");
    drugs.update(drugsStock,'product_id',function(err,result){
      if(err){
        logger.error(req.session.user[0].realname + "新增采购记录，更新库存出错" + err);
      }
    });
  }
});
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
		remark:req.body.remark
  }
  purchase.update(params,'purchase_id',function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "修改采购记录出错" + err);
    }
    res.json({"code":"000000",message:null});
  });

  if(req.body.storage_time || req.body.storage_time_temp){//入库更新库存
    var stock = 0;
    if(req.body.storage_time_temp && req.body.storage_time){
      stock = parseInt(req.body.stock)-parseInt(req.body.purchase_number_temp)+parseInt(req.body.purchase_number);
    }else if(req.body.storage_time_temp && !req.body.storage_time){
      stock = parseInt(req.body.stock)-parseInt(req.body.purchase_number);
    }else if(!req.body.storage_time_temp && req.body.storage_time){
      stock = parseInt(req.body.stock)+parseInt(req.body.purchase_number);
    }
    var drugsStock = {
      product_id:req.body.product_id,
      stock:stock
    }
    var drugs = DB.get("Drugs");
    drugs.update(drugsStock,'product_id',function(err,result){
      if(err){
        logger.error(req.session.user[0].realname + "修改采购记录，更新库存出错" + err);
      }
    });
  }
});
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
    var drugsStock = {
      product_id:productId,
      stock:stock-purchaseNumber
    }
    var drugs = DB.get("Drugs");
    drugs.update(drugsStock,'product_id',function(err,result){
      if(err){
        logger.error(req.session.user[0].realname + "删除采购记录，更新库存出错" + err);
      }
    });
  }
});
//导出备货列表
router.get("/exportPurchases",function(req,res){
  if(req.session.user[0].authority_code.indexOf("57") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var purchase = DB.get("Purchase");
  req.body.data = {
    productCommonName:req.query.name,
    time:[req.query.start,req.query.end],
    contactId:req.query.contactId,
    product_code:req.query.product_code,
    status:req.query.status,
    remark:req.query.remark
  };
  var sql = getPurchasesSql(req);
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
      req.body.page.purchaseMoney = purchaseMoney && purchaseMoney[0].purchaseMoney?purchaseMoney[0].purchaseMoney.toFixed(2):0;
      req.body.page.totalCount = result;
      req.body.page.totalPage = Math.ceil(req.body.page.totalCount / req.body.page.limit);
      sql += " order by p.time desc,p.purchase_id desc limit " + req.body.page.start + "," + req.body.page.limit + "";
      purchase.executeSql(sql,function(err,result){
        if(err){
          logger.error(req.session.user[0].realname + "查询采购记录出错" + err);
        }
        req.body.page.data = result;
        res.json({"code":"000000",message:req.body.page});
      });
    });
  });
});
function getPurchasesSql(req){
  var sql = "select dbus.*,bus.business_name from drugs dbus left join business bus on dbus.product_business = bus.business_id ";
      sql = "select p.*,d.product_id,d.stock,d.product_code,d.contacts_name,d.product_type,d.buyer,d.product_common_name,"+
            "d.product_specifications,d.product_supplier,d.product_makesmakers,d.product_unit,d.product_packing,d.business_name"+
            " from purchase p left join (select dd.*,c.contacts_name from ("+sql+") dd left join contacts c "+
            "on dd.contacts_id = c.contacts_id) d on p.drug_id = d.product_id where p.delete_flag = '0' and d.group_id = '"+req.session.user[0].group_id+"'";
  if(req.body.data.productCommonName){
    sql += " and (d.product_common_name like '%"+req.body.data.productCommonName+"%' or d.product_name_pinyin like '%"+req.body.data.productCommonName+"%')";
  }
  if(req.body.data.contactId){
    sql += " and d.contacts_id = '"+req.body.data.contactId+"'"
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
