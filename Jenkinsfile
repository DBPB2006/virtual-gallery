pipeline {
    agent any

    environment {
        // Docker Registry credentials and image settings
        DOCKER_HUB_CREDENTIALS_ID = 'docker-hub-credentials'
        DOCKER_REGISTRY = 'docker.io'
        DOCKER_USER = 'dbpb2006'
        
        // Target AWS EC2 SSH connection parameters
        SSH_CREDENTIALS_ID = 'ec2-ssh-credentials'
        EC2_PUBLIC_IP = '100.31.194.101'
        EC2_USER = 'ubuntu'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Build Docker Images') {
            steps {
                script {
                    echo "Building Production Docker Images via Compose..."
                    sh "docker compose build"
                }
            }
        }

        stage('Push Docker Images to Docker Hub') {
            steps {
                script {
                    echo "Authenticating with Docker Hub..."
                    withCredentials([usernamePassword(credentialsId: "${DOCKER_HUB_CREDENTIALS_ID}", usernameVariable: 'DH_USER', passwordVariable: 'DH_PASSWORD')]) {
                        sh "echo \$DH_PASSWORD | docker login -u \$DH_USER --password-stdin ${DOCKER_REGISTRY}"
                    }
                    echo "Pushing Docker Images to Registry..."
                    sh "docker push ${DOCKER_USER}/virtual-gallery-client:latest"
                    sh "docker push ${DOCKER_USER}/virtual-gallery-auth:latest"
                    sh "docker push ${DOCKER_USER}/virtual-gallery-backend:latest"
                    sh "docker push ${DOCKER_USER}/virtual-gallery-payment:latest"
                }
            }
        }

        stage('Deploy to AWS EC2') {
            steps {
                script {
                    echo "Deploying to AWS EC2 instance: ${EC2_PUBLIC_IP}"
                    sshagent(credentials: ["${SSH_CREDENTIALS_ID}"]) {
                        // Transfer the unified Compose file to the deployment server
                        sh "scp -o StrictHostKeyChecking=no docker-compose.yml ${EC2_USER}@${EC2_PUBLIC_IP}:~/docker-compose.yml"
                        
                        // Execute deployment pulling and runtime restart via SSH
                        sh """
                            ssh -o StrictHostKeyChecking=no ${EC2_USER}@${EC2_PUBLIC_IP} '
                                # Pull the latest images from Docker Hub
                                docker compose pull
                                
                                # Launch/re-create containers
                                docker compose up -d --remove-orphans
                                
                                # Clean old images from disk
                                docker image prune -f
                            '
                        """
                    }
                }
            }
        }
    }

    post {
        always {
            sh 'docker logout || true'
        }
        success {
            echo "CI/CD Pipeline executed successfully!"
        }
        failure {
            echo "CI/CD Pipeline failed!"
        }
    }
}