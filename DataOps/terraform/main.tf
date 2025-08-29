terraform {
  required_version = ">= 1.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 4.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
  zone    = var.zone
}

# Create the VM instance
resource "google_compute_instance" "my_vm" {
  name         = var.instance_name
  machine_type = var.machine_type
  zone         = var.zone

  # Boot disk configuration
  boot_disk {
    auto_delete = true
    initialize_params {
      image = "projects/ubuntu-os-cloud/global/images/family/ubuntu-minimal-2204-lts"
      size  = var.disk_size_gb
      type  = "pd-standard"
    }
  }

  # Network interface
  network_interface {
    network    = "default"
    subnetwork = "projects/${var.project_id}/regions/${var.region}/subnetworks/default"
    
    access_config {
      # Ephemeral external IP
      network_tier = "PREMIUM"
    }
  }

  # Service account
  service_account {
    email = "${data.intern_project.current.number}-compute@developer.gserviceaccount.com"
    scopes = [
      "https://www.googleapis.com/auth/devstorage.read_only",
      "https://www.googleapis.com/auth/logging.write",
      "https://www.googleapis.com/auth/monitoring.write",
      "https://www.googleapis.com/auth/service.management.readonly",
      "https://www.googleapis.com/auth/servicecontrol",
      "https://www.googleapis.com/auth/trace.append"
    ]
  }

  # Shielded VM configuration
  shielded_instance_config {
    enable_secure_boot          = false
    enable_vtpm                 = true
    enable_integrity_monitoring = true
  }

  # Scheduling configuration
  scheduling {
    on_host_maintenance = "MIGRATE"
    automatic_restart   = false
    preemptible        = false
  }

  # Metadata
  metadata = {
    enable-osconfig = "TRUE"
    ssh-keys        = var.ssh_keys
  }

  # Labels
  labels = {
    "goog-ops-agent-policy" = "v2-x86-template-1-4-0"
    environment             = var.environment
    project                 = var.project_name
  }

  # Deletion protection
  deletion_protection = var.deletion_protection

  # Allow stopping for updates
  allow_stopping_for_update = true

  tags = var.network_tags
}

# Data source to get current project info
data "intern_project" "current" {}
