import swaggerJSDoc from 'swagger-jsdoc';
import { SwaggerUiOptions } from 'swagger-ui-express';

const options: swaggerJSDoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Uber Clone API',
      version: '1.0.0',
      description: 'API documentation for the Uber Clone application',
    },
    servers: [
      {
        url: 'http://localhost:5001',
        description: 'Development server',
      },
    ],
    components: {
        securitySchemes: {
            bearerAuth: {
                type: 'http',
                scheme: 'bearer',
                bearerFormat: 'JWT',
            }
        }
    },
    security: [
        {
            bearerAuth: []
        }
    ]
  },
  apis: ['./src/api/routes/*.ts'],
};

export const swaggerSpec = swaggerJSDoc(options);

export const swaggerUiOptions: SwaggerUiOptions = {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Uber Clone API Docs',
}; 