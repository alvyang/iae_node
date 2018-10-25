var express = require("express");
var pinyin = require("node-pinyin");
var nodeExcel = require('excel-export');
var logger = require('../utils/logger');
var util= require('../utils/global_util.js');
var router = express.Router();


//修改销售政策
router.post("/editSalesPolicy",function(req,res){
  if(req.session.user[0].authority_code.indexOf("860afa00-d43d-11e8-984b-5b9b376cac6a") < 0){
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
});
//导出
router.post("/exportSalesPolicy",function(req,res){
  if(req.session.user[0].authority_code.indexOf("c250c860-d81f-11e8-a52f-4f446572c8cf") < 0){
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
    },{caption:'厂家返利',type:'string'
    },{caption:'销售政策',type:'string'
    }];
    var header = ['product_code', 'product_common_name', 'product_specifications',
                  'product_makesmakers','product_unit','business_name','product_price','product_return_money','allot_policy_money'];
    conf.rows = util.formatExcel(header,result);
    var result = nodeExcel.execute(conf);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats');
    res.setHeader("Content-Disposition", "attachment; filename=" + "Report.xlsx");
    res.end(result, 'binary');
  });
});
//查询销售政策
router.post("/getSalesPolicy",function(req,res){
  if(req.session.user[0].authority_code.indexOf("83ff2470-d43d-11e8-984b-5b9b376cac6a") < 0){
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
  var sql = "select * from drugs d left join sale_policy sp on d.product_id = sp.sale_drug_id "+
            " and (sp.sale_hospital_id = '"+req.body.data.hospitalId+"' || sp.sale_hospital_id is null) "+
            " where d.delete_flag='0' and d.group_id = '"+req.session.user[0].group_id+"' "+
            " and d.product_type in ('佣金','高打')";
  if(req.body.data.productCommonName){
    sql += " and (d.product_common_name like '%"+req.body.data.productCommonName+"%' or d.product_name_pinyin like '%"+req.body.data.productCommonName+"%')"
  }
  if(req.body.data.sale_contact_id){
    sql += " and sp.sale_policy_contact_id = '"+req.body.data.sale_contact_id+"'";
  }
  //连接商业
  sql = "select * from ("+sql+") dsp left join business b on dsp.product_business = b.business_id";
  return sql;
}
module.exports = router;
