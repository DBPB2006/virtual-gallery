pipeline {
    agent any

    environment {

        // Docker Hub
        DOCKER_HUB_CREDENTIALS_ID = 'docker-hub-credentials'
        DOCKER_REGISTRY = 'docker.io'
        DOCKER_USER = 'dbpb'

        // EC2 Deployment
        SSH_CREDENTIALS_ID = 'ec2-ssh-credentials'
        EC2_PUBLIC_IP = '100.31.194.101'
        EC2_USER = 'ubuntu'
    }

    stages {
// stage 1
        stage('Checkout') {
            steps {
                checkout scm
            }
        }
// stage 2
        stage('Build Docker Images') {
            steps {
                script {

                    sh "docker build -t ${DOCKER_USER}/client:latest ./client"

                    sh "docker build -t ${DOCKER_USER}/auth-service:latest ./auth-service"

                    sh "docker build -t ${DOCKER_USER}/backend-service:latest ./backend-service"

                    sh "docker build -t ${DOCKER_USER}/payment-service:latest ./payment-service"
                }
            }
        }
// stage 3
        stage('Push Docker Images to Docker Hub') {
            steps {
                script {

                    withCredentials([
                        usernamePassword(
                            credentialsId: "${DOCKER_HUB_CREDENTIALS_ID}",
                            usernameVariable: 'DH_USER',
                            passwordVariable: 'DH_PASSWORD'
                        )
                    ]) {

                        sh """
                            echo \$DH_PASSWORD | docker login \
                            -u \$DH_USER \
                            --password-stdin ${DOCKER_REGISTRY}
                        """
                    }

                    sh "docker push ${DOCKER_USER}/client:latest"

                    sh "docker push ${DOCKER_USER}/auth-service:latest"

                    sh "docker push ${DOCKER_USER}/backend-service:latest"

                    sh "docker push ${DOCKER_USER}/payment-service:latest"
                }
            }
        }
// stage 4
        stage('Deploy to AWS EC2') {
            steps {
                script {

                    sshagent(credentials: ["${SSH_CREDENTIALS_ID}"]) {

                        sh """
                            ssh -o StrictHostKeyChecking=no ${EC2_USER}@${EC2_PUBLIC_IP} '

                                cd ~/virtual-gallery

                                docker compose pull

                                docker compose up -d --remove-orphans

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