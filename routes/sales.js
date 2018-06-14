var express = require("express");
var nodeExcel = require('excel-export');
var fs = require('fs');
var util= require('../utils/global_util.js');
var router = express.Router();

//导出
router.get("/exportSales",function(req,res){
  if(req.session.user[0].authority_code.indexOf("70") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var sales = DB.get("Sales");
  req.body.data = {
    productCommonName:req.query.name,
    salesTime:[req.query.start,req.query.end],
    hospitalsId:req.query.id,
    productType:req.query.type
  };
  var sql = getQuerySql(req);
  sales.executeSql(sql,function(err,result){
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
    },{caption:'单位',type:'string'
    },{caption:'中标价',type:'number'
    },{caption:'计划数量',type:'number'
    },{caption:'购入金额',type:'number'
    },{caption:'品种类型',type:'string'
    },{caption:'采购员',type:'string'
    }];
    var header = ['bill_date', 'hospital_name', 'product_code', 'product_common_name', 'product_specifications','product_unit','sale_price','sale_num','sale_money','product_type','buyer'];
    conf.rows = util.formatExcel(header,result);
    console.log(conf.rows);
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
    res.json({"code":"000000",message:result});
  });
});
//新增联系人
router.post("/saveSales",function(req,res){
  if(req.session.user[0].authority_code.indexOf("48") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var sales = DB.get("Sales");
  req.body.group_id = req.session.user[0].group_id;
  req.body.bill_date = new Date(req.body.bill_date).format('yyyy-MM-dd');
  sales.insertIncrement(req.body,function(err,result){
    res.json({"code":"000000",message:result});
  });
});
//编辑销售记录
router.post("/editSales",function(req,res){
  if(req.session.user[0].authority_code.indexOf("66") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
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
		delete_flag:req.body.delete_flag,
	  group_id:req.body.group_id,
		bill_date:req.body.bill_date,
		hospital_id:req.body.hospital_id,
  }
  sales.update(params,'sale_id',function(err,result){
    res.json({"code":"000000",message:null});
  });
});
//删除联系人
router.post("/deleteSales",function(req,res){
  if(req.session.user[0].authority_code.indexOf("67") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var sales = DB.get("Sales");
  req.body.delete_flag = 1;
  sales.update(req.body,'sale_id',function(err,result){
    res.json({"code":"000000",message:null});
  });
});
//获取联系人列表
router.post("/getSales",function(req,res){
  if(req.session.user[0].authority_code.indexOf("65") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var sales = DB.get("Sales");
  var sql = getQuerySql(req);
  sales.countBySql(sql,function(err,result){
    var numSql = "select sum(num.sale_money) as saleMoney from ( " + sql + " ) num";
    sales.executeSql(numSql,function(err,saleMoney){
      req.body.page.totalCount = result;
      req.body.page.saleMoney = saleMoney[0].saleMoney?saleMoney[0].saleMoney.toFixed(2):0;
      req.body.page.totalPage = Math.ceil(req.body.page.totalCount / req.body.page.limit);
      sql += " order by s.bill_date desc,s.sale_id desc limit " + req.body.page.start + "," + req.body.page.limit + "";
      sales.executeSql(sql,function(err,result){
        req.body.page.data = result;
        res.json({"code":"000000",message:req.body.page});
      });
    });
  });
});
function getQuerySql(req){
  var sh = "select sh.*,h.hospital_name from sales sh left join hospitals h on sh.hospital_id = h.hospital_id where sh.group_id = '"+req.session.user[0].group_id+"' ";
  var sql = "select s.*,d.product_type,d.buyer,d.product_business,d.product_common_name,d.product_specifications,d.product_makesmakers,d.product_unit,d.product_packing"+
            " from ("+sh+") s left join drugs d on s.product_code = d.product_code where s.delete_flag = '0' and d.group_id = '"+req.session.user[0].group_id+"' ";
  if(req.body.data.productCommonName){
    sql += " and (d.product_common_name like '%"+req.body.data.productCommonName+"%' or d.product_name_pinyin like '%"+req.body.data.productCommonName+"%')";
  }
  if(req.body.data.productType){
    var type = req.body.data.productType;
    var t = "";
    for(var i = 0 ; i < type.length ; i++){
      t+="'"+type[i]+"',"
    }
    t = t.substring(0,t.length-1);
    sql += " and d.product_type in ("+t+")";
  }
  if(req.body.data.hospitalsId){
    sql += " and s.hospital_id = '"+req.body.data.hospitalsId+"'"
  }
  if(req.body.data.business){
    sql += " and d.product_business = '"+req.body.data.business+"'"
  }
  if(req.body.data.salesTime){
    var start = new Date(req.body.data.salesTime[0]).format("yyyy-MM-dd");
    var end = new Date(req.body.data.salesTime[1]).format("yyyy-MM-dd");
    sql += " and DATE_FORMAT(s.bill_date,'%Y-%m-%d') >= '"+start+"' and DATE_FORMAT(s.bill_date,'%Y-%m-%d') <= '"+end+"'";
  }
  return sql;
}
//获取联系人列表
router.post("/getAllContacts",function(req,res){
  var contacts = DB.get("Contacts");
  req.body.group_id = req.session.user[0].group_id;
  req.body.delete_flag = 0;
  contacts.where(req.body,function(err,result){
    res.json({"code":"000000",message:result});
  });
});
module.exports = router;
