pipeline {
    agent any

    environment {

        // Docker Hub Credentials
        DOCKER_HUB_CREDENTIALS_ID = 'docker-hub-credentials'
        DOCKER_REGISTRY = 'docker.io'
        DOCKER_USER = 'dbpb'

        // AWS EC2 Deployment
        EC2_PUBLIC_IP = '35.153.49.67'
        EC2_USER = 'ubuntu'
    }

    stages {

        // =========================
        // Stage 1 - Checkout Code
        // =========================
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        // =========================
        // Stage 2 - Build Images
        // =========================
        stage('Build Docker Images') {
            steps {
                script {

                    echo "Building Client Image..."
                    sh """
                        docker build \
                        --platform linux/amd64 \
                        -t ${DOCKER_USER}/client:latest \
                        ./client
                    """

                    echo "Building Auth Service Image..."
                    sh """
                        docker build \
                        --platform linux/amd64 \
                        -t ${DOCKER_USER}/auth-service:latest \
                        ./auth-service
                    """

                    echo "Building Backend Service Image..."
                    sh """
                        docker build \
                        --platform linux/amd64 \
                        -t ${DOCKER_USER}/backend-service:latest \
                        ./backend-service
                    """

                    echo "Building Payment Service Image..."
                    sh """
                        docker build \
                        --platform linux/amd64 \
                        -t ${DOCKER_USER}/payment-service:latest \
                        ./payment-service
                    """
                }
            }
        }

        // =========================
        // Stage 3 - Push to Docker Hub
        // =========================
        stage('Push Docker Images to Docker Hub') {
            steps {
                script {

                    echo "Logging into Docker Hub..."

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

                    echo "Pushing Client Image..."
                    sh "docker push ${DOCKER_USER}/client:latest"

                    echo "Pushing Auth Service Image..."
                    sh "docker push ${DOCKER_USER}/auth-service:latest"

                    echo "Pushing Backend Service Image..."
                    sh "docker push ${DOCKER_USER}/backend-service:latest"

                    echo "Pushing Payment Service Image..."
                    sh "docker push ${DOCKER_USER}/payment-service:latest"
                }
            }
        }

        // =========================
        // Stage 4 - Deploy to EC2
        // =========================
        stage('Deploy to AWS EC2') {
            steps {
                script {

                    echo "Deploying latest containers to EC2..."

                    sh """
                        ssh -i ~/Downloads/virtual-gallery.pem \
                        -o StrictHostKeyChecking=no \
                        ${EC2_USER}@${EC2_PUBLIC_IP} '

                            cd ~/virtual-gallery

                            docker compose pull

                            docker compose up -d --remove-orphans
                        '
                    """
                }
            }
        }
    }

    // =========================
    // Post Actions
    // =========================
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