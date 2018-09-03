module.exports = {
	key:'Refunds',
	name:'refunds',
	fields:['refunds_id',
          'refunds_should_time',
          'refunds_should_money',
          'refunds_real_time',
          'refunds_real_money',
          'refundser',
          'receiver',
          'sales_id',
          'purchases_id',
					'service_charge']
};
insert into bank_account_detail(flag_id,account_id,account_detail_money,account_detail_time,account_detail_mark,account_detail_deleta_flag,account_detail_group_id)
select CONCAT('sale_',sr.sale_id),null,sr.refunds_real_money,sr.refunds_real_time,CONCAT(DATE_FORMAT(sr.bill_date,'%Y-%m-%d'),'销售',d.product_common_name,'返款') mark,'1',1  from (
select r.receiver,r.refunds_real_money,r.refunds_real_time,s.product_code,s.bill_date,s.sale_id from sales s left join refunds r on s.sale_id = r.sales_id
where  s.sale_return_flag='1' and s.sale_id='73'
) sr left join drugs d on d.product_code = sr.product_code
