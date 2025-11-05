const chargesTable = `CREATE TABLE IF NOT EXISTS charges (
	charge_id int auto_increment primary key,
	lease_id varchar(255) not null,
	charge_type varchar(50) not null,
	description varchar(500),
	amount decimal(10,2) not null,
	amount_paid decimal(10,2) default 0 not null,
	charge_date datetime default CURRENT_TIMESTAMP(),
	due_date date not null,
	is_recurring boolean default false not null,
	status varchar(50) default 'Unpaid' not null,
	template_id int default null,

	foreign key (lease_id) references leases(lease_id),
	foreign key (template_id) references recurring_templates(template_id)
) ENGINE=InnoDB;`;

export default chargesTable;