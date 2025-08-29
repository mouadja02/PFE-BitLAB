variable "project_id" {
  description = "The GCP project ID"
  type        = string
}

variable "project_name" {
  description = "The project name for labeling"
  type        = string
  default     = "internproject"
}

variable "region" {
  description = "The GCP region"
  type        = string
  default     = "europe-west9"
}

variable "zone" {
  description = "The GCP zone"
  type        = string
  default     = "europe-west9-b"
}

variable "instance_name" {
  description = "Name of the VM instance"
  type        = string
  default     = "my-vm"
}

variable "machine_type" {
  description = "The machine type for the VM"
  type        = string
  default     = "e2-custom-4-6144"  # 4 vCPUs, 6GB RAM
}

variable "disk_size_gb" {
  description = "Size of the boot disk in GB"
  type        = number
  default     = 30
}

variable "environment" {
  description = "Environment label (dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "deletion_protection" {
  description = "Enable deletion protection"
  type        = bool
  default     = false
}

variable "network_tags" {
  description = "Network tags for firewall rules"
  type        = list(string)
  default     = []
}

variable "ssh_keys" {
  description = "SSH keys for VM access"
  type        = string
  default     = ""
}
