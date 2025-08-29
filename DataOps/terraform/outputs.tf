output "vm_name" {
  description = "Name of the created VM"
  value       = google_compute_instance.my_vm.name
}

output "vm_zone" {
  description = "Zone where the VM is deployed"
  value       = google_compute_instance.my_vm.zone
}

output "vm_internal_ip" {
  description = "Internal IP address of the VM"
  value       = google_compute_instance.my_vm.network_interface[0].network_ip
}

output "vm_external_ip" {
  description = "External IP address of the VM"
  value       = google_compute_instance.my_vm.network_interface[0].access_config[0].nat_ip
}

output "vm_self_link" {
  description = "Self-link of the VM"
  value       = google_compute_instance.my_vm.self_link
}

output "ssh_command" {
  description = "SSH command to connect to the VM"
  value       = "gcloud compute ssh ${google_compute_instance.my_vm.name} --zone=${google_compute_instance.my_vm.zone} --project=${var.project_id}"
}
