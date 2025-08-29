# Copy this file to terraform.tfvars and fill in your values

project_id    = "your-project-id"
project_name  = "your-project-name"
region        = "europe-west9"
zone          = "europe-west9-b"
instance_name = "my-vm"
environment   = "dev"

# Optional: Add your SSH keys (replace with your actual SSH keys)
ssh_keys = <<-EOF
username:ssh-rsa AAAAB3NzaC1yc2EAAAA... user@domain.com
username:ecdsa-sha2-nistp256 AAAAE2VjZHNh... user@domain.com
EOF

# Optional: Network tags for firewall rules
network_tags = ["http-server", "https-server"]

# Optional: Enable deletion protection
deletion_protection = false
