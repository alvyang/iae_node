var express = require("express");
var util= require('../utils/global_util.js');
var logger = require('../utils/logger');
var nodeExcel = require('excel-export');
var fs = require('fs');
var parse = require('csv-parse');
var router = express.Router();

//导出库存
router.post("/exportStocks",function(req,res){
  if(req.session.user[0].authority_code.indexOf(",144") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var findParam = JSON.stringify(req.body);
  req.body.data = JSON.parse(findParam);
  var drugs = DB.get("Drugs");
  var sql = getDrugsSql(req);
  sql += " order by sbus.product_create_time desc "
  drugs.executeSql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "导出库存列表出错" + err);
    }
    var conf ={};
    conf.stylesXmlFile = "./utils/styles.xml";
    conf.name = "mysheet";
    conf.cols = [{caption:'产品编码',type:'string'
    },{caption:'产品名称',type:'string'
    },{caption:'产品规格',type:'string'
    },{caption:'生产厂家',type:'string'
    },{caption:'包装',type:'string'
    },{caption:'单位',type:'string'
    },{caption:'商业',type:'string'
    },{caption:'库存',type:'number',
      beforeCellWrite:function(row, cellData){
        return cellData?cellData:0;
      }
    },{caption:'联系人',type:'string'
    }];
    var header = ['product_code', 'product_common_name', 'product_specifications', 'product_makesmakers', 'product_packing',
                  'product_unit','business_name','batch_stock_number','contacts_name'];
    conf.rows = util.formatExcel(header,result);
    var result = nodeExcel.execute(conf);
    var message = req.session.user[0].realname+"导出库存记录。"+conf.rows.length+"条";
    util.saveLogs(req.session.user[0].group_id,"-",findParam,message);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats');
    res.setHeader("Content-Disposition", "attachment; filename=" + "Report.xlsx");
    res.end(result, 'binary');
  });

});
//获取药品的所有，批次库存
router.post("/getBatchStockByDrugId",function(req,res){
  var batchStock = DB.get("BatchStock");
  var sql = "select bs.*,p.purchase_number,p.purchase_other_money from batch_stock bs left join purchase p on bs.batch_stock_purchase_id = p.purchase_id "+
            "where  bs.tag_type_delete_flag = '0' and bs.tag_type_group_id = '"+req.session.user[0].group_id+"' "+
            "and bs.batch_stock_drug_id = '"+req.body.productId+"' and bs.batch_stock_number > 0 "+
            "and p.delete_flag = '0' and p.group_id = '"+req.session.user[0].group_id+"' ";
  batchStock.executeSql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "由药品id，查询批次库存出错" + err);
    }
    res.json({"code":"000000",message:result});
  });
});

//编辑菜单
router.post("/deleteBatchStock",function(req,res){
  var batchStock = DB.get("BatchStock");
  var sql = "update batch_stock set tag_type_delete_flag='1' where "+
            "batch_stock_purchase_id='"+req.body.batch_stock_purchase_id+"' and batch_stock_drug_id='"+req.body.batch_stock_drug_id+"'";
  batchStock.executeSql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "删除批次库存出错" + err);
    }
    var message = req.session.user[0].realname+"删除库存记录。id："+req.body.batch_stock_purchase_id;
    util.saveLogs(req.session.user[0].group_id,"-","-",message);
    res.json({"code":"000000",message:null});
  });
});
//编辑菜单
router.post("/editBatchStock",function(req,res){
  var batchStock = DB.get("BatchStock");
  var sql = "update batch_stock set batch_stock_number='"+req.body.batch_stock_number+"' where "+
            "batch_stock_purchase_id='"+req.body.batch_stock_purchase_id+"' and batch_stock_drug_id='"+req.body.batch_stock_drug_id+"'";
  batchStock.executeSql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "修改批次库存出错" + err);
    }
    res.json({"code":"000000",message:null});
  });
});

//获取药品列表
router.post("/getDrugsStockList",function(req,res){
  // if(req.session.user[0].authority_code.indexOf(",65") < 0){
  //   res.json({"code":"111112",message:"无权限"});
  //   return ;
  // }
  var batchStock = DB.get("BatchStock");
  var sql = "select * from batch_stock bs where bs.tag_type_delete_flag = '0' and bs.tag_type_group_id = '"+req.session.user[0].group_id+"' "+
            "and bs.batch_stock_drug_id = '"+req.body.data.drug_id+"'";
  batchStock.countBySql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "查询批次库存列表，查询总数出错" + err);
    }
    req.body.page.totalCount = result;
    req.body.page.totalPage = Math.ceil(req.body.page.totalCount / req.body.page.limit);
    sql += " order by bs.batch_stock_time desc limit " + req.body.page.start + "," + req.body.page.limit + "";
    batchStock.executeSql(sql,function(err,result){
      if(err){
        logger.error(req.session.user[0].realname + "查询批次库存列表出错" + err);
      }
      req.body.page.data = result;
      res.json({"code":"000000",message:req.body.page});
    });
  });
});

//获取药品库存  以及当前备货量
router.post("/getDrugsStock",function(req,res){
  var drugs = DB.get("Drugs");
  var sql = getDrugsSql(req);
  var purchaseSql = "select pur.drug_id,sum(pur.purchase_number) purnum from purchase pur where "+
                    "pur.delete_flag = '0' and pur.group_id='"+req.session.user[0].group_id+"' and pur.storage_time is null "+
                    "group by pur.drug_id";
  sql = "select sbusp.*,IFNULL(purSql.purnum, 0) pnum from ("+sql+") sbusp left join ("+purchaseSql+") purSql on sbusp.product_id = purSql.drug_id"
  drugs.countBySql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "查询药品列表，查询总数出错" + err);
    }
    req.body.page.totalCount = result;
    req.body.page.totalPage = Math.ceil(req.body.page.totalCount / req.body.page.limit);
    sql += " order by sbusp.product_create_time desc limit " + req.body.page.start + "," + req.body.page.limit + "";
    drugs.executeSql(sql,function(err,result){
      if(err){
        logger.error(req.session.user[0].realname + "查询药品列表出错" + err);
      }
      req.body.page.data = result;
      res.json({"code":"000000",message:req.body.page});
    });
  });
});
function getDrugsSql(req){
  var salesSql = "select * from drugs ds where ds.delete_flag = '0' and ds.group_id = '"+req.session.user[0].group_id+"'";
  var sql = "select d.*,c.contacts_name from ("+salesSql+") d left join contacts c on d.contacts_id = c.contacts_id where 1=1";
  if(req.body.data.productCommonName){
    sql += " and (d.product_common_name like '%"+req.body.data.productCommonName+"%' or d.product_name_pinyin like '%"+req.body.data.productCommonName+"%')";
  }
  if(req.body.data.product_code){
    sql += " and d.product_code = '"+req.body.data.product_code+"'"
  }
  if(req.body.data.business){
    sql += " and d.product_business = '"+req.body.data.business+"'"
  }
  if(req.body.data.product_type){
    var type = req.body.data.product_type;
    if(typeof type == 'object'){
      var t = type.join(",").replace(/,/g,"','");
      sql += " and d.product_type in ('"+t+"')"
    }else{
      sql += " and d.product_type in ('"+type+"')"
    }
  }
  if(req.body.data.product_distribution_flag){
    sql += " and d.product_distribution_flag = '"+req.body.data.product_distribution_flag+"'";
  }
  var stockSql = "select sum(bs.batch_stock_number) batch_stock_number,bs.batch_stock_drug_id from batch_stock bs where bs.tag_type_delete_flag = '0' and bs.tag_type_group_id = '"+req.session.user[0].group_id+"' group by bs.batch_stock_drug_id " ;
  var sql = "select bsd.*,IFNULL(stockSql.batch_stock_number, 0) batch_stock_number from ("+sql+") bsd left join ("+stockSql+") stockSql on bsd.product_id = stockSql.batch_stock_drug_id "
  sql = "select sbus.*,bus.business_name from ("+sql+") sbus left join business bus on sbus.product_business = bus.business_id ";
  return sql;
}
//编辑菜单
router.post("/editStock",function(req,res){
  // if(req.session.user[0].authority_code.indexOf(",63") < 0){
  //   res.json({"code":"111112",message:"无权限"});
  //   return ;
  // }
  var drugs = DB.get("Drugs");
  drugs.update(req.body,'product_id',function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "修改库存出错" + err);
    }
    res.json({"code":"000000",message:null});
  });
});

//分组查询，获取备注
router.post("/getStockAnalysis",function(req,res){
  var drug = DB.get("Drugs");
  var month = util.getSixMonth();
  // var sql = "select p.remark from purchase p where p.delete_flag = '0' and p.group_id = '"+req.session.user[0].group_id+"' and p.remark is not null and p.remark !='' group by p.remark"
  var productCode = req.body.productCode;
  var productId = req.body.productId;
  //销售统计sql
  var sql = "select sum(s.sale_num) as num,DATE_FORMAT(s.bill_date,'%Y-%m') as time from sales s where s.delete_flag = '0' and s.group_id = '"+req.session.user[0].group_id+"'";
  sql += " and s.product_code = '"+productCode+"'";
  sql += " group by DATE_FORMAT(s.bill_date,'%Y-%m') desc"
  //调货统计sql
  var allotSql = "select sum(a.allot_number) as anum,DATE_FORMAT(a.allot_time,'%Y-%m') as time from allot a where a.allot_delete_flag = '0' and a.allot_group_id = '"+req.session.user[0].group_id+"'";
  allotSql += " and a.allot_drug_id = '"+productId+"'";
  allotSql += " group by DATE_FORMAT(a.allot_time,'%Y-%m') desc"
  drug.executeSql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "统计库存，销售统计出错" + err);
    }
    drug.executeSql(allotSql,function(err,allot){
      if(err){
        logger.error(req.session.user[0].realname + "统计库存，调货统计出错" + err);
      }
      var num = [];
      var anum = [];
      for(var i = 0 ; i < month.length ;i++){
        for(var j = 0 ; j < result.length;j++){
          if(month[i] == result[j].time){
            num[i]=result[j].num;
          }
        }
        if(!num[i]){
          num[i]=0;
        }
        for(var j = 0 ; j < allot.length;j++){
          if(month[i] == allot[j].time){
            anum[i]=allot[j].anum;
          }
        }
        if(!anum[i]){
          anum[i]=0;
        }
      }
      var data = {time:month,num:num,anum:anum}
      res.json({"code":"000000",message:data});
    });
  });
});
module.exports = router;
